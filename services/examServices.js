const pool = require("../database/db");

/**
 * --- GLOBAL FIXES & ENHANCEMENTS (v3) ---
 * 1. Question Shuffling: `ORDER BY RANDOM()` is now used to shuffle questions for each session.
 * 2. Intelligent Retakes: Students can only retake an exam if it has been updated since their last submission.
 * 3. Save/Resume Progress: The service now looks for in-progress sessions and returns saved answers and time.
 * 4. Submit Progress: A new service function `saveExamProgress` handles periodic updates from the student.
 */

// #region --- Start & Resume Exam Session ---

exports.startExamSession = async (userId, examId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch exam details, including the crucial updated_at timestamp.
        const examResult = await client.query(
            "SELECT *, updated_at as version_timestamp FROM exams WHERE exam_id = $1",
            [examId]
        );
        if (examResult.rows.length === 0) throw new Error("Exam not found.");
        const exam = examResult.rows[0];

        if (exam.is_locked) throw new Error("This exam is currently locked by the administrator.");

        // 2. Check for a previous SUBMITTED result to handle retakes.
        const previousSubmission = await client.query(
            "SELECT exam_version_timestamp FROM exam_results WHERE student_id = $1 AND exam_id = $2",
            [userId, examId]
        );

        if (previousSubmission.rows.length > 0) {
            const lastSubmissionVersion = new Date(previousSubmission.rows[0].exam_version_timestamp).getTime();
            const currentExamVersion = new Date(exam.version_timestamp).getTime();
            
            if (currentExamVersion <= lastSubmissionVersion) {
                throw new Error("You have already completed the most recent version of this exam. A retake is only allowed if the exam has been updated.");
            }
            // This is an authorized retake. Delete old session to start fresh.
             await client.query("DELETE FROM exam_sessions WHERE user_id = $1 AND exam_id = $2", [userId, examId]);
        }
        
        // 3. Check for an IN-PROGRESS session to resume from.
        const inProgressSession = await client.query(
            "SELECT * FROM exam_sessions WHERE user_id = $1 AND exam_id = $2 AND end_time IS NULL",
            [userId, examId]
        );

        // 4. Fetch questions (shuffled).
        const questionsResult = await client.query(
            `SELECT question_id, question_text, option_a, option_b, option_c, option_d, marks 
             FROM questions WHERE exam_id = $1 ORDER BY RANDOM()`,
            [examId]
        );
        if (questionsResult.rows.length === 0) throw new Error("This exam has no questions available.");
        
        const transformedQuestions = questionsResult.rows.map(q => ({
            question_id: q.question_id, question_text: q.question_text,
            options: [
                { option_id: 'a', option_text: q.option_a }, { option_id: 'b', option_text: q.option_b },
                { option_id: 'c', option_text: q.option_c }, { option_id: 'd', option_text: q.option_d }
            ],
            marks: q.marks
        }));

        let sessionData = {};
        
        if (inProgressSession.rows.length > 0) {
            // --- RESUME A PREVIOUSLY UNFINISHED SESSION ---
            sessionData = {
                progress: inProgressSession.rows[0].progress || {},
                timeRemaining: inProgressSession.rows[0].time_remaining_seconds,
            };
            console.log(`Resuming session for user ${userId}, exam ${examId}`);
        } else {
            // --- START A COMPLETELY NEW SESSION ---
             console.log(`Starting new session for user ${userId}, exam ${examId}`);
            await client.query(
                `INSERT INTO exam_sessions (user_id, exam_id, start_time, time_remaining_seconds) VALUES ($1, $2, NOW(), $3)`,
                [userId, examId, exam.duration_minutes * 60]
            );
        }
        
        await client.query('COMMIT');
        return { exam, questions: transformedQuestions, session: sessionData };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Exam start/resume service error:", error);
        throw error; // Re-throw to be handled by the route
    } finally {
        client.release();
    }
};

// #endregion

// #region --- Save Progress ---

// **FIX**: Added the missing saveExamProgress function that was being called by the route but was not defined.
exports.saveExamProgress = async (userId, examId, answers, timeRemaining) => {
    try {
        const result = await pool.query(
            `UPDATE exam_sessions SET progress = $1, time_remaining_seconds = $2, updated_at = NOW()
             WHERE user_id = $3 AND exam_id = $4 AND end_time IS NULL`,
            [answers, timeRemaining, userId, examId]
        );
        if (result.rowCount === 0) {
            // This might happen if the session was submitted or deleted in another tab.
            // It's not a critical error, but good to be aware of.
            console.warn(`Attempted to save progress for a non-existent or completed session. User: ${userId}, Exam: ${examId}`);
            return { message: "No active session to save." };
        }
        return { message: "Progress saved." };
    } catch (error) {
        console.error("Save progress service error:", error);
        throw new Error("Failed to save progress due to a database error.");
    }
};

// #endregion

// #region --- Submit Exam ---

exports.submitExam = async (userId, examId, answers, timeTakenSeconds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Fetch exam details to get its version and type
        const examDetails = await client.query("SELECT updated_at, exam_type FROM exams WHERE exam_id = $1", [examId]);
        if (examDetails.rows.length === 0) throw new Error("Exam not found for submission.");
        const { updated_at: examVersionTimestamp, exam_type: examType } = examDetails.rows[0];

        // --- Standard Score Calculation Logic ---
        const totalMarksResult = await client.query("SELECT SUM(marks) as total_marks FROM questions WHERE exam_id = $1", [examId]);
        const totalPossibleMarks = parseInt(totalMarksResult.rows[0].total_marks || 0);

        const questionsResult = await client.query("SELECT question_id, correct_answer, marks FROM questions WHERE exam_id = $1", [examId]);
        let rawScoreObtained = 0;
        questionsResult.rows.forEach(q => {
            if (answers[q.question_id] && answers[q.question_id].toUpperCase() === q.correct_answer.toUpperCase()) {
                rawScoreObtained += (q.marks || 0);
            }
        });
        const percentageScore = totalPossibleMarks > 0 ? (rawScoreObtained / totalPossibleMarks) * 100 : 0;
        
        // --- Insert Result with Version Timestamp ---
        const resultInsertQuery = await client.query(
            `INSERT INTO exam_results (student_id, exam_id, score, raw_score_obtained, total_possible_marks, answers, submission_date, time_taken_seconds, exam_version_timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)
             ON CONFLICT (student_id, exam_id) DO UPDATE SET 
                score = EXCLUDED.score, 
                raw_score_obtained = EXCLUDED.raw_score_obtained, 
                total_possible_marks = EXCLUDED.total_possible_marks,
                answers = EXCLUDED.answers, 
                submission_date = NOW(), 
                time_taken_seconds = EXCLUDED.time_taken_seconds,
                exam_version_timestamp = EXCLUDED.exam_version_timestamp
             RETURNING result_id;`,
            [userId, examId, percentageScore, rawScoreObtained, totalPossibleMarks, answers, timeTakenSeconds, examVersionTimestamp]
        );
        const newResultId = resultInsertQuery.rows[0].result_id;

        // End the session
        await client.query("UPDATE exam_sessions SET end_time = NOW(), progress = NULL, time_remaining_seconds = 0 WHERE user_id = $1 AND exam_id = $2", [userId, examId]);
        
        await client.query('COMMIT');
        
        return {
            resultId: newResultId,
            score: percentageScore,
            examType: examType // This tells the frontend how to behave post-submission
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Exam submission service error:", error);
        throw new Error("Failed to submit exam: " + error.message);
    } finally {
        client.release();
    }
};


// #endregion
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

        // 1. Fetch exam details, including the crucial updated_at timestamp and is_locked status.
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
        // Fetch questions for all sections of the exam
        const questionsResult = await client.query(
            `SELECT q.question_id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.marks, 
                    es.section_id, es.section_name as section_name, es.section_instructions
             FROM questions q
             JOIN exam_sections es ON q.section_id = es.section_id
             WHERE q.exam_id = $1 ORDER BY RANDOM()`,
            [examId]
        );
        if (questionsResult.rows.length === 0) throw new Error("This exam has no questions available.");
        
        // Organize questions by section and transform options into an array
        const sectionsMap = new Map();
        questionsResult.rows.forEach(q => {
            if (!sectionsMap.has(q.section_id)) {
                sectionsMap.set(q.section_id, {
                    section_id: q.section_id,
                    section_name: q.section_name, // Use section_name for consistency with frontend
                    section_instructions: q.section_instructions,
                    questions: []
                });
            }
            sectionsMap.get(q.section_id).questions.push({
                question_id: q.question_id,
                question_text: q.question_text,
                options: [
                    { id: 'A', text: q.option_a }, // Changed option_id to A, B, C, D
                    { id: 'B', text: q.option_b },
                    { id: 'C', text: q.option_c },
                    { id: 'D', text: q.option_d }
                ],
                marks: q.marks
            });
        });
        const transformedSections = Array.from(sectionsMap.values());


        let sessionData = {};
        
        if (inProgressSession.rows.length > 0) {
            // --- RESUME A PREVIOUSLY UNFINISHED SESSION ---
            sessionData = {
                progress: inProgressSession.rows[0].progress || null, // Ensure it's null if no progress
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
        return { exam, sections: transformedSections, session: sessionData }; // Changed 'questions' to 'sections'
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
            [JSON.stringify(answers), timeRemaining, userId, examId] // Ensure answers are stringified if JSONB
        );
        if (result.rowCount === 0) {
            // This might happen if the session was submitted or deleted in another tab.
            // It's not a critical error, but good to be aware of.
            console.warn(`Attempted to save progress for user ${userId}, exam ${examId} but no active session found.`);
            return { message: "No active session to save progress for." };
        }
        return { message: "Progress saved successfully." };
    } catch (error) {
        console.error("Error saving exam progress:", error);
        throw new Error("Failed to save exam progress: " + error.message);
    }
};
// #endregion

// #region --- Submit Exam ---

exports.submitExam = async (userId, examId, answers, timeTakenSeconds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch exam details to get correct answers, total marks, and pass mark
        const examDetailsResult = await client.query(
            `SELECT e.exam_id, e.title, e.pass_mark, e.exam_type, e.updated_at as version_timestamp,
                    q.question_id, q.correct_answer, q.marks
             FROM exams e
             JOIN exam_sections es ON e.exam_id = es.exam_id
             JOIN questions q ON es.section_id = q.section_id
             WHERE e.exam_id = $1`,
            [examId]
        );

        if (examDetailsResult.rows.length === 0) {
            throw new Error("Exam or its questions not found for grading.");
        }

        const exam = examDetailsResult.rows[0]; // Get exam-level details once
        const correctAnswersMap = new Map();
        const questionMarksMap = new Map();
        let totalPossibleMarks = 0;

        examDetailsResult.rows.forEach(row => {
            correctAnswersMap.set(row.question_id, row.correct_answer);
            questionMarksMap.set(row.question_id, row.marks);
            totalPossibleMarks += row.marks; // Sum up marks from all questions
        });

        let rawScoreObtained = 0;
        // Calculate score based on submitted answers
        for (const questionId in answers) {
            const submittedAnswer = answers[questionId];
            const correctAnswer = correctAnswersMap.get(parseInt(questionId)); // Ensure questionId is int

            if (correctAnswer && submittedAnswer === correctAnswer) {
                rawScoreObtained += questionMarksMap.get(parseInt(questionId)) || 0;
            }
        }

        // Calculate percentage score
        const percentageScore = totalPossibleMarks > 0 ? (rawScoreObtained / totalPossibleMarks) * 100 : 0;
        const examType = exam.exam_type; // Get exam type for frontend logic

        // 2. Save the result to exam_results table
        // Use ON CONFLICT to update if a result for this student/exam already exists (e.g., retake)
        const resultInsertQuery = await client.query(
            `INSERT INTO exam_results (
                student_id, exam_id, score, raw_score_obtained, total_possible_marks,
                answers, submission_date, time_taken_seconds, exam_version_timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)
             ON CONFLICT (student_id, exam_id) DO UPDATE SET 
                score = EXCLUDED.score, 
                raw_score_obtained = EXCLUDED.raw_score_obtained, 
                total_possible_marks = EXCLUDED.total_possible_marks,
                answers = EXCLUDED.answers, 
                submission_date = NOW(), 
                time_taken_seconds = EXCLUDED.time_taken_seconds,
                exam_version_timestamp = EXCLUDED.exam_version_timestamp
             RETURNING result_id;`,
            [userId, examId, percentageScore, rawScoreObtained, totalPossibleMarks, JSON.stringify(answers), timeTakenSeconds, exam.version_timestamp] // Ensure answers are stringified if JSONB
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

const pool = require("../database/db");

/**
 * --- GLOBAL FIXES & ENHANCEMENTS ---
 * 1. Question Loading Fix: The SQL query now correctly joins through `exam_sections` to find questions, fixing the "exam has no questions" error.
 * 2. Question Shuffling: `ORDER BY RANDOM()` is used to shuffle questions for each session.
 * 3. Intelligent Retakes: Students can only retake an exam if it has been updated since their last submission.
 * 4. Save/Resume Progress: The service looks for in-progress sessions and returns saved answers and time.
 */

// #region --- Start & Resume Exam Session ---

exports.startExamSession = async (userId, examId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const examResult = await client.query(
            "SELECT *, updated_at as version_timestamp FROM exams WHERE exam_id = $1",
            [examId]
        );
        if (examResult.rows.length === 0) throw new Error("Exam not found.");
        const exam = examResult.rows[0];

        if (exam.is_locked) throw new Error("This exam is currently locked by the administrator.");

        const previousSubmission = await client.query(
            "SELECT exam_version_timestamp FROM exam_results WHERE student_id = $1 AND exam_id = $2",
            [userId, examId]
        );

        if (previousSubmission.rows.length > 0) {
            const lastSubmissionVersion = new Date(previousSubmission.rows[0].exam_version_timestamp).getTime();
            const currentExamVersion = new Date(exam.version_timestamp).getTime();
            
            if (currentExamVersion <= lastSubmissionVersion) {
                throw new Error("You have already completed the most recent version of this exam.");
            }
            await client.query("DELETE FROM exam_sessions WHERE user_id = $1 AND exam_id = $2", [userId, examId]);
        }
        
        const inProgressSession = await client.query(
            "SELECT * FROM exam_sessions WHERE user_id = $1 AND exam_id = $2 AND end_time IS NULL",
            [userId, examId]
        );

        // FIXED: The query now correctly joins questions to exams via the exam_sections table.
        // It uses `es.exam_id` instead of the incorrect `q.exam_id`.
        const questionsResult = await client.query(
            `SELECT q.question_id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.marks, 
                    es.section_id, es.section_name, es.section_instructions
             FROM questions q
             JOIN exam_sections es ON q.section_id = es.section_id
             WHERE es.exam_id = $1 ORDER BY RANDOM()`,
            [examId]
        );
        if (questionsResult.rows.length === 0) throw new Error("This exam has no questions available.");
        
        const sectionsMap = new Map();
        questionsResult.rows.forEach(q => {
            if (!sectionsMap.has(q.section_id)) {
                sectionsMap.set(q.section_id, {
                    section_id: q.section_id,
                    section_name: q.section_name,
                    section_instructions: q.section_instructions,
                    questions: []
                });
            }
            sectionsMap.get(q.section_id).questions.push({
                question_id: q.question_id,
                question_text: q.question_text,
                options: [
                    { id: 'A', text: q.option_a },
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
            sessionData = {
                progress: inProgressSession.rows[0].progress || null,
                timeRemaining: inProgressSession.rows[0].time_remaining_seconds,
            };
        } else {
            await client.query(
                `INSERT INTO exam_sessions (user_id, exam_id, start_time, time_remaining_seconds) VALUES ($1, $2, NOW(), $3)`,
                [userId, examId, exam.duration_minutes * 60]
            );
        }

        await client.query('COMMIT');
        return { exam, sections: transformedSections, session: sessionData };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Exam start/resume service error:", error);
        throw error;
    } finally {
        client.release();
    }
};

// #endregion

// #region --- Save Progress ---
exports.saveExamProgress = async (userId, examId, answers, timeRemaining) => {
    try {
        const result = await pool.query(
            `UPDATE exam_sessions SET progress = $1, time_remaining_seconds = $2, updated_at = NOW()
             WHERE user_id = $3 AND exam_id = $4 AND end_time IS NULL`,
            [JSON.stringify(answers), timeRemaining, userId, examId]
        );
        if (result.rowCount === 0) {
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

        const exam = examDetailsResult.rows[0];
        const correctAnswersMap = new Map();
        const questionMarksMap = new Map();
        let totalPossibleMarks = 0;

        examDetailsResult.rows.forEach(row => {
            correctAnswersMap.set(row.question_id, row.correct_answer);
            questionMarksMap.set(row.question_id, row.marks);
            totalPossibleMarks += row.marks;
        });

        let rawScoreObtained = 0;
        for (const questionId in answers) {
            const submittedAnswer = answers[questionId];
            const correctAnswer = correctAnswersMap.get(parseInt(questionId));

            if (correctAnswer && submittedAnswer === correctAnswer) {
                rawScoreObtained += questionMarksMap.get(parseInt(questionId)) || 0;
            }
        }

        const percentageScore = totalPossibleMarks > 0 ? (rawScoreObtained / totalPossibleMarks) * 100 : 0;
        const examType = exam.exam_type;

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
            [userId, examId, percentageScore, rawScoreObtained, totalPossibleMarks, JSON.stringify(answers), timeTakenSeconds, exam.version_timestamp]
        );
        const newResultId = resultInsertQuery.rows[0].result_id;

        await client.query("UPDATE exam_sessions SET end_time = NOW(), progress = NULL, time_remaining_seconds = 0 WHERE user_id = $1 AND exam_id = $2", [userId, examId]);
        
        await client.query('COMMIT');
        
        return {
            resultId: newResultId,
            score: percentageScore,
            examType: examType
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

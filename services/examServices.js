const pool = require("../database/db");

/**
 * --- GLOBAL FIXES & ENHANCEMENTS ---
 * 1. Question Loading Fix: The SQL query now correctly joins through `exam_sections` to find questions, fixing the "exam has no questions" error.
 * 2. Question Shuffling: `ORDER BY RANDOM()` is used to shuffle questions for each session.
 * 3. Intelligent Retakes: Students can only retake an exam if it has been updated since their last submission.
 * 4. Save/Resume Progress: The service looks for in-progress sessions and returns saved answers and time.
 * 5. Individual Question Marks: Calculates score based on individual question marks.
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
            const lastSubmissionTimestamp = new Date(previousSubmission.rows[0].exam_version_timestamp);
            const examLastUpdated = new Date(exam.version_timestamp);

            // Allow retake only if exam has been updated since last submission
            if (examLastUpdated <= lastSubmissionTimestamp) {
                throw new Error("You have already submitted this exam and it has not been updated since your last attempt. Retakes are not allowed unless the exam is updated.");
            }
        }

        // Check for an existing in-progress session
        const existingSessionQuery = await client.query(
            "SELECT progress, time_remaining_seconds FROM exam_sessions WHERE user_id = $1 AND exam_id = $2 AND end_time IS NULL",
            [userId, examId]
        );

        let savedProgress = null;
        let savedTimeRemaining = exam.duration_minutes * 60; // Default to full duration

        if (existingSessionQuery.rows.length > 0) {
            const sessionData = existingSessionQuery.rows[0];
            if (sessionData.progress) {
                savedProgress = sessionData.progress; // This is already JSONB, no need to parse
            }
            if (sessionData.time_remaining_seconds !== null) {
                savedTimeRemaining = sessionData.time_remaining_seconds;
            }
        }

        // Fetch exam sections and questions with their marks
        const sectionsResult = await client.query(
            `SELECT section_id, section_name, section_instructions, section_order
             FROM exam_sections WHERE exam_id = $1 ORDER BY section_order ASC`,
            [examId]
        );

        let questions = [];
        for (const sectionRow of sectionsResult.rows) {
            const questionsResult = await client.query(
                `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks
                 FROM questions WHERE section_id = $1 ORDER BY RANDOM()`, // Shuffle questions
                [sectionRow.section_id]
            );
            questions.push(...questionsResult.rows.map(q => ({
                question_id: q.question_id,
                question_text: q.question_text,
                options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
                explanation: q.explanation,
                marks: q.marks // Include marks
            })));
        }

        if (questions.length === 0) {
            throw new Error("This exam has no questions configured.");
        }

        // Insert or update exam session
        await client.query(
            `INSERT INTO exam_sessions (user_id, exam_id, start_time, time_remaining_seconds, progress)
             VALUES ($1, $2, NOW(), $3, $4)
             ON CONFLICT (user_id, exam_id) DO UPDATE SET
                start_time = NOW(),
                end_time = NULL,
                time_remaining_seconds = $3,
                progress = $4
             WHERE exam_sessions.end_time IS NULL RETURNING *;`, // Only update if session is still active
            [userId, examId, savedTimeRemaining, savedProgress] // Use saved time and progress
        );

        await client.query('COMMIT');

        return {
            examId: exam.exam_id,
            title: exam.title,
            description: exam.description,
            duration_minutes: exam.duration_minutes,
            questions: questions,
            savedProgress: savedProgress,
            timeRemainingSeconds: savedTimeRemaining,
            examType: exam.exam_type
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error starting exam session:", error);
        throw error;
    } finally {
        client.release();
    }
};

// #endregion

// #region --- Save Exam Progress ---

exports.saveExamProgress = async (userId, examId, answers, timeRemainingSeconds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Update the existing session with current progress and time remaining
        const result = await client.query(
            `UPDATE exam_sessions
             SET progress = $1, time_remaining_seconds = $2, updated_at = NOW()
             WHERE user_id = $3 AND exam_id = $4 AND end_time IS NULL
             RETURNING *;`,
            [JSON.stringify(answers), timeRemainingSeconds, userId, examId]
        );

        if (result.rows.length === 0) {
            // This might happen if the session was already ended or doesn't exist
            throw new Error("No active exam session found to save progress for.");
        }

        await client.query('COMMIT');
        return { message: "Progress saved successfully!" };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error saving exam progress:", error);
        throw error;
    } finally {
        client.release();
    }
};

// #endregion

// #region --- Submit Exam ---

exports.submitExam = async (userId, examId, answers, timeTakenSeconds) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch exam details and its questions with marks
        const examResult = await client.query(
            "SELECT exam_id, title, pass_mark, exam_type, updated_at as version_timestamp, sections FROM exams WHERE exam_id = $1",
            [examId]
        );
        if (examResult.rows.length === 0) {
            throw new Error("Exam not found.");
        }
        const exam = examResult.rows[0];
        const examType = exam.exam_type;

        // Retrieve the structured sections and questions from the exam's 'sections' JSONB column
        const examSectionsStructure = exam.sections;
        if (!examSectionsStructure || !Array.isArray(examSectionsStructure) || examSectionsStructure.length === 0) {
            throw new Error("Exam structure (sections/questions) not found or is invalid.");
        }

        let rawScoreObtained = 0;
        let totalPossibleMarks = 0;
        const questionIdsInExam = new Set();
        const questionMarksMap = new Map(); // Map to store question_id -> marks

        // Iterate through the exam structure to get all questions and their marks
        for (const section of examSectionsStructure) {
            if (section.questions && Array.isArray(section.questions)) {
                for (const q of section.questions) {
                    questionIdsInExam.add(q.question_id);
                    // Fetch full question details to get correct_answer and marks
                    const fullQuestionDetails = await client.query(
                        `SELECT correct_answer, marks FROM questions WHERE question_id = $1`,
                        [q.question_id]
                    );
                    if (fullQuestionDetails.rows.length > 0) {
                        const correct_answer = fullQuestionDetails.rows[0].correct_answer;
                        const marks = fullQuestionDetails.rows[0].marks || 0; // Default to 0 if marks is null/undefined

                        questionMarksMap.set(q.question_id, { correct_answer, marks });
                        totalPossibleMarks += marks; // Sum all possible marks
                    }
                }
            }
        }

        // Calculate score based on submitted answers and question marks
        for (const questionId in answers) {
            if (questionIdsInExam.has(parseInt(questionId))) { // Ensure the question belongs to this exam
                const studentAnswer = answers[questionId];
                const questionDetails = questionMarksMap.get(parseInt(questionId));

                if (questionDetails && studentAnswer === questionDetails.correct_answer) {
                    rawScoreObtained += questionDetails.marks;
                }
            }
        }

        // Calculate percentage score
        const percentageScore = totalPossibleMarks > 0 ? (rawScoreObtained / totalPossibleMarks) * 100 : 0;

        // 2. Save the result
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

        // 3. End the exam session
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
        throw error;
    } finally {
        client.release();
    }
};

// #endregion

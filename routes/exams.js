const express = require('express');
const router = express.Router();
const pool = require('../database/db'); // Assuming this correctly points to your PostgreSQL connection pool
const auth = require('../middlewares/auth'); // Middleware for authentication

// Helper function to get full exam details, ensuring a consistent data structure
// Uses JOINs for efficiency and structured data retrieval.
async function getExamWithSectionsAndQuestions(examId) {
  try {
    const examResult = await pool.query(
      `SELECT e.*, s.name as subject_name, cl.level_name as class_level_name
       FROM exams e
       LEFT JOIN subjects s ON e.subject_id = s.subject_id
       LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
       WHERE e.exam_id = $1`,
      [examId]
    );

    if (examResult.rows.length === 0) {
      return null;
    }
    const examData = examResult.rows[0];

    // Fetch sections for the exam, ordered by section_order
    const sectionsResult = await pool.query(
      `SELECT section_id, section_name, section_instructions, section_order
       FROM exam_sections WHERE exam_id = $1 ORDER BY section_order ASC`,
      [examId]
    );

    const sections = [];
    for (const sectionRow of sectionsResult.rows) {
      // Fetch questions for each section, ordered by question_id for consistency
      const questionsResult = await pool.query(
        `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks
         FROM questions WHERE section_id = $1 ORDER BY question_id ASC`,
        [sectionRow.section_id]
      );
      sections.push({
        ...sectionRow,
        questions: questionsResult.rows,
      });
    }

    return {
      ...examData,
      sections: sections,
    };
  } catch (error) {
    console.error(`Error in getExamWithSectionsAndQuestions for examId ${examId}:`, error);
    throw new Error("Failed to retrieve exam details."); // Re-throw to be caught by route handler
  }
}

// GET all exams (with optional filters)
// Authenticated route to fetch exams based on various criteria.
router.get("/", auth, async (req, res) => {
    try {
        const { subject_id, class_level_id, created_by } = req.query;
        let query = `
            SELECT e.*, s.name as subject_name, cl.level_name as class_level_name
            FROM exams e
            LEFT JOIN subjects s ON e.subject_id = s.subject_id
            LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (subject_id) {
            query += ` AND e.subject_id = $${paramIndex++}`;
            params.push(subject_id);
        }
        if (class_level_id) {
            query += ` AND e.class_level_id = $${paramIndex++}`;
            params.push(class_level_id);
        }
        if (created_by) {
            query += ` AND e.created_by = $${paramIndex++}`;
            params.push(created_by);
        }

        query += ` ORDER BY e.created_at DESC`; // Order by creation date, newest first

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching exams:", error);
        res.status(500).json({ error: "Failed to fetch exams." });
    }
});

// GET exam by ID
// Fetches a single exam with all its sections and questions.
router.get("/:examId", auth, async (req, res) => {
    try {
        const { examId } = req.params;
        // Basic input validation for examId
        if (isNaN(parseInt(examId))) {
            return res.status(400).json({ error: "Invalid Exam ID format." });
        }

        const exam = await getExamWithSectionsAndQuestions(parseInt(examId));
        if (!exam) {
            return res.status(404).json({ error: "Exam not found." });
        }
        res.json(exam);
    } catch (error) {
        console.error("Error fetching exam by ID:", error);
        res.status(500).json({ error: "Failed to fetch exam." });
    }
});

// POST create new exam
// Allows an authenticated user to create a new exam with sections and questions.
router.post("/", auth, async (req, res) => {
    const {
        title,
        exam_instructions,
        duration_minutes,
        subject_id,
        class_level_id,
        max_score,
        pass_mark, // Ensure this is correctly received from the frontend
        start_time,
        end_time,
        exam_type,
        is_locked,
        term,
        session,
        sections,
    } = req.body;

    // Validate all required fields
    if (!title || duration_minutes === undefined || !subject_id || !class_level_id || !sections || sections.length === 0 ||
        max_score === undefined || pass_mark === undefined || !start_time || !end_time || !exam_type ||
        term === undefined || session === undefined) {
        return res.status(400).json({ error: "Missing required exam fields or sections." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        const examResult = await client.query(
            `INSERT INTO exams (
                title, exam_instructions, duration_minutes, subject_id, class_level_id,
                max_score, pass_mark, start_time, end_time, exam_type, is_locked,
                term, session, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING exam_id`,
            [
                title, exam_instructions, duration_minutes, subject_id, class_level_id,
                max_score, pass_mark, start_time, end_time, exam_type, is_locked,
                term, session, req.user.id // Set created_by to the authenticated user's ID
            ]
        );
        const examId = examResult.rows[0].exam_id;

        // Insert sections and their questions in order
        for (const [sectionIndex, section] of sections.entries()) {
            // Validate section fields
            if (!section.section_name || !section.questions || section.questions.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Section at index ${sectionIndex} is missing name or questions.` });
            }

            const sectionResult = await client.query(
                `INSERT INTO exam_sections (exam_id, section_name, section_instructions, section_order)
                VALUES ($1, $2, $3, $4) RETURNING section_id`,
                [examId, section.section_name, section.section_instructions, sectionIndex + 1]
            );
            const sectionId = sectionResult.rows[0].section_id;

            for (const question of section.questions) {
                 // Validate question fields
                if (!question.question_text || !question.correct_answer || question.marks === undefined) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `Question in section ${section.section_name} is missing text, correct answer, or marks.` });
                }
                await client.query(
                    `INSERT INTO questions (
                        section_id, question_text, option_a, option_b, option_c, option_d,
                        correct_answer, explanation, marks, exam_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        sectionId, question.question_text, question.option_a, question.option_b,
                        question.option_c, question.option_d, question.correct_answer,
                        question.explanation, question.marks, examId // Store exam_id directly in questions table
                    ]
                );
            }
        }

        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ message: "Exam created successfully!", examId: examId });
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error("Error creating exam:", error);
        res.status(500).json({ error: "Failed to create exam: " + error.message });
    } finally {
        client.release(); // Release client back to pool
    }
});

// PUT update exam
// Allows updating an existing exam, including its sections and questions.
router.put("/:examId", auth, async (req, res) => {
    const { examId } = req.params;
    const {
        title,
        exam_instructions,
        duration_minutes,
        subject_id,
        class_level_id,
        max_score,
        pass_mark,
        start_time,
        end_time,
        exam_type,
        is_locked,
        term,
        session,
        sections,
    } = req.body;

    // Validate exam ID and required fields
    if (isNaN(parseInt(examId))) {
        return res.status(400).json({ error: "Invalid Exam ID format." });
    }
    if (!title || duration_minutes === undefined || !subject_id || !class_level_id || !sections || sections.length === 0 ||
        max_score === undefined || pass_mark === undefined || !start_time || !end_time || !exam_type ||
        term === undefined || session === undefined) {
        return res.status(400).json({ error: "Missing required exam fields or sections." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Update exam main details
        const parsedExamId = parseInt(examId);
        if (isNaN(parsedExamId)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Invalid Exam ID format after parsing." });
        }

        const updateExamResult = await client.query(
            `UPDATE exams SET
                title = $1,
                exam_instructions = $2,
                duration_minutes = $3,
                subject_id = $4,
                class_level_id = $5,
                max_score = $6,
                pass_mark = $7,
                start_time = $8,
                end_time = $9,
                exam_type = $10,
                is_locked = $11,
                term = $12,
                session = $13,
                updated_at = NOW()
            WHERE exam_id = $14
            RETURNING created_by`,
            [
                title, exam_instructions, duration_minutes, subject_id, class_level_id,
                max_score, pass_mark, start_time, end_time, exam_type, is_locked,
                term, session, parsedExamId
            ]
        );

        if (updateExamResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Exam not found." });
        }

        // Authorization check: Only admin or the creator can update
        if (!req.user.is_admin && updateExamResult.rows[0].created_by !== req.user.id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Access denied. You can only edit exams you created or if you are an admin." });
        }

        // 2. Handle sections and questions: Delete all existing and re-insert
        await client.query(`DELETE FROM questions WHERE exam_id = $1`, [parsedExamId]);
        await client.query(`DELETE FROM exam_sections WHERE exam_id = $1`, [parsedExamId]);

        for (const [sectionOrder, section] of sections.entries()) {
            // Validate section fields
            if (!section.section_name || !section.questions || section.questions.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Section at index ${sectionOrder} is missing name or questions.` });
            }

            const sectionResult = await client.query(
                `INSERT INTO exam_sections (exam_id, section_name, section_instructions, section_order)
                VALUES ($1, $2, $3, $4) RETURNING section_id`,
                [parsedExamId, section.section_name, section.section_instructions, sectionOrder + 1]
            );
            const sectionId = sectionResult.rows[0].section_id;

            for (const question of section.questions) {
                // Validate question fields
                if (!question.question_text || !question.correct_answer || question.marks === undefined) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `Question in section ${section.section_name} is missing text, correct answer, or marks.` });
                }
                await client.query(
                    `INSERT INTO questions (
                        section_id, question_text, option_a, option_b, option_c, option_d,
                        correct_answer, explanation, marks, exam_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [
                        sectionId, question.question_text, question.option_a, question.option_b,
                        question.option_c, question.option_d, question.correct_answer,
                        question.explanation, question.marks, parsedExamId
                    ]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: "Exam updated successfully!", examId: parsedExamId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error updating exam:", error);
        res.status(500).json({ error: "Failed to update exam: " + error.message });
    } finally {
        client.release();
    }
});


// DELETE EXAM - (No changes needed)
router.delete("/:examId", auth, async (req, res) => {
    const { examId } = req.params;
    if (isNaN(parseInt(examId))) return res.status(400).json({ error: "Invalid Exam ID format." });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch exam to check ownership before deleting
        const examCheckResult = await pool.query(`SELECT created_by FROM exams WHERE exam_id = $1`, [examId]);
        if (examCheckResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Exam not found." });
        }
        const createdBy = examCheckResult.rows[0].created_by;

        // Authorization check: Only admin or the creator can delete
        if (!req.user.is_admin && createdBy !== req.user.id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Access denied. You can only delete exams you created or if you are an admin." });
        }


        // Delete questions associated with the exam's sections
        await client.query(`
            DELETE FROM questions
            WHERE section_id IN (SELECT section_id FROM exam_sections WHERE exam_id = $1)
        `, [examId]);

        // Delete exam sessions for this exam
        await client.query(`DELETE FROM exam_sessions WHERE exam_id = $1`, [examId]);

        // Delete exam results for this exam
        await client.query(`DELETE FROM exam_results WHERE exam_id = $1`, [examId]);

        // Delete exam sections
        await client.query(`DELETE FROM exam_sections WHERE exam_id = $1`, [examId]);

        // Delete the exam itself
        const deleteResult = await client.query(`DELETE FROM exams WHERE exam_id = $1`, [examId]);

        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Exam not found." });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: "Exam and its associated sections/questions deleted successfully." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error deleting exam:", error);
        res.status(500).json({ error: "Failed to delete exam. " + error.message });
    } finally {
        client.release();
    }
});

// NEW: GET user exam statistics
router.get("/user-stats/:userId", auth, async (req, res) => {
    const { userId } = req.params;

    // Ensure the authenticated user is either an admin or the user themselves
    if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
        return res.status(403).json({ error: "Unauthorized access to user statistics." });
    }

    try {
        // Total Exams Taken
        const totalExamsTakenResult = await pool.query(
            `SELECT COUNT(DISTINCT exam_id) FROM exam_results WHERE student_id = $1`,
            [userId]
        );
        const totalExamsTaken = parseInt(totalExamsTakenResult.rows[0].count || 0);

        // Exams Passed (assuming pass_mark is stored with the exam and score is in exam_results)
        const examsPassedResult = await pool.query(
            `SELECT COUNT(er.result_id)
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             WHERE er.student_id = $1 AND er.score >= e.pass_mark`,
            [userId]
        );
        const examsPassed = parseInt(examsPassedResult.rows[0].count || 0);

        // Highest Score
        const highestScoreResult = await pool.query(
            `SELECT MAX(score) FROM exam_results WHERE student_id = $1`,
            [userId]
        );
        const highestScore = parseFloat(highestScoreResult.rows[0].max || 0).toFixed(1);

        // FIX: Corrected query to count keys in a JSONB object (answers column)
        const totalQuestionsAnsweredResult = await pool.query(
            `SELECT COALESCE(SUM( (SELECT COUNT(*) FROM jsonb_object_keys(er.answers)) ), 0) AS total_answered_questions
             FROM exam_results er
             WHERE er.student_id = $1 AND er.answers IS NOT NULL`,
            [userId]
        );
        const totalQuestionsAnswered = parseInt(totalQuestionsAnsweredResult.rows[0].total_answered_questions || 0);


        res.json({
            totalExamsTaken,
            examsPassed,
            highestScore,
            totalQuestionsAnswered
        });

    } catch (error) {
        console.error("Error fetching user statistics:", error);
        res.status(500).json({ error: "Failed to fetch user stats." });
    }
});


// Config routes for subjects and class levels (moved from a separate config file or assumed here)
router.get("/config/subjects", auth, async (req, res) => {
    try {
        const { class_level_id } = req.query;
        let query = `SELECT * FROM subjects`;
        const params = [];
        if (class_level_id) {
            query += ` WHERE class_level_id = $1`;
            params.push(class_level_id);
        }
        query += ` ORDER BY name ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching subjects config:", error);
        res.status(500).json({ error: "Failed to fetch subjects config." });
    }
});

router.get("/config/class-levels", auth, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM class_levels ORDER BY level_name ASC`);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching class levels config:", error);
        res.status(500).json({ error: "Failed to fetch class levels config." });
    }
});

module.exports = router;

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

      // Map options to an object for easier frontend handling
      const questions = questionsResult.rows.map(q => ({
          question_id: q.question_id,
          question_text: q.question_text,
          options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          marks: q.marks // Include marks for each question
      }));

      sections.push({
        section_id: sectionRow.section_id,
        section_name: sectionRow.section_name,
        section_instructions: sectionRow.section_instructions,
        section_order: sectionRow.section_order,
        questions: questions
      });
    }

    examData.sections = sections;
    return examData;

  } catch (error) {
    console.error("Error in getExamWithSectionsAndQuestions:", error);
    throw error; // Re-throw to be caught by the route handler
  }
}

// GET /api/exams/user-stats - Get statistics for the logged-in user
// MOVED THIS ROUTE ABOVE /:id TO PREVENT "user-stats" BEING PARSED AS AN ID
router.get("/user-stats", auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Total exams taken
        const totalExamsTakenQuery = await pool.query(
            `SELECT COUNT(DISTINCT exam_id) FROM exam_results WHERE student_id = $1`,
            [userId]
        );
        const totalExamsTaken = parseInt(totalExamsTakenQuery.rows[0].count) || 0;

        // Exams passed (assuming pass_mark is stored in exams table)
        const examsPassedQuery = await pool.query(
            `SELECT COUNT(er.result_id)
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             WHERE er.student_id = $1 AND er.score >= e.pass_mark`,
            [userId]
        );
        const examsPassed = parseInt(examsPassedQuery.rows[0].count) || 0;

        // Highest score
        const highestScoreQuery = await pool.query(
            `SELECT MAX(score) FROM exam_results WHERE student_id = $1`,
            [userId]
        );
        const highestScore = parseFloat(highestScoreQuery.rows[0].max) || 0;

        // Total questions answered (This might need adjustment if total_possible_marks in exam_results
        // doesn't accurately reflect questions answered, but rather total marks available.
        // For now, it sums total_possible_marks from results, which is fine if each question is 1 mark
        // or if total_possible_marks is the sum of marks for questions in that exam)
        const totalQuestionsAnsweredQuery = await pool.query(
            `SELECT SUM(total_possible_marks) FROM exam_results WHERE student_id = $1`,
            [userId]
        );
        const totalQuestionsAnswered = parseInt(totalQuestionsAnsweredQuery.rows[0].sum) || 0;


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

// NEW ROUTE: GET /api/exams/teacher-stats - Get statistics for exams created by a specific teacher
router.get("/teacher-stats", auth, async (req, res) => {
    try {
        const teacherId = req.user.id;
        // Authorization: Only teachers can access this route
        if (req.user.role !== 'teacher' && !req.user.is_admin) {
            return res.status(403).json({ error: "Unauthorized: Only teachers and administrators can view teacher statistics." });
        }

        // Total exams created by this teacher
        const totalExamsCreatedQuery = await pool.query(
            `SELECT COUNT(*) FROM exams WHERE created_by = $1`,
            [teacherId]
        );
        const totalExamsCreated = parseInt(totalExamsCreatedQuery.rows[0].count) || 0;

        // Total students who attempted exams created by this teacher
        const totalStudentsAttemptedQuery = await pool.query(
            `SELECT COUNT(DISTINCT er.student_id)
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             WHERE e.created_by = $1`,
            [teacherId]
        );
        const totalStudentsAttempted = parseInt(totalStudentsAttemptedQuery.rows[0].count) || 0;

        // Total students who passed exams created by this teacher
        const totalStudentsPassedQuery = await pool.query(
            `SELECT COUNT(DISTINCT er.student_id)
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             WHERE e.created_by = $1 AND er.score >= e.pass_mark`,
            [teacherId]
        );
        const totalStudentsPassed = parseInt(totalStudentsPassedQuery.rows[0].count) || 0;

        res.json({
            totalExamsCreated,
            totalStudentsAttempted,
            totalStudentsPassed
        });

    } catch (error) {
        console.error("Error fetching teacher statistics:", error);
        res.status(500).json({ error: "Failed to fetch teacher statistics." });
    }
});


// FIXED: GET /api/exams - Fetch all exams with filters
router.get("/", auth, async (req, res) => {
  try {
    const { subject_id, class_level_id, exam_type, term, session, created_by } = req.query;
    const requestingUser = req.user;

    // FIXED: Replaced `scheduled_time` with `start_time` and `end_time`.
    let query = `
      SELECT
        e.exam_id, e.title, e.duration_minutes, e.pass_mark, e.max_score,
        e.exam_type, e.term, e.session, e.start_time, e.end_time, e.is_locked,
        e.created_by, e.updated_at, s.name AS subject_name, cl.level_name AS class_level_name
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
    if (exam_type) {
        query += ` AND e.exam_type = $${paramIndex++}`;
        params.push(exam_type);
    }
    if (term) {
        query += ` AND e.term = $${paramIndex++}`;
        params.push(term);
    }
    if (session) {
        query += ` AND e.session = $${paramIndex++}`;
        params.push(session);
    }
    if (created_by) {
        query += ` AND e.created_by = $${paramIndex++}`;
        params.push(created_by);
    }

    if (requestingUser.role === 'student') {
        query += ` AND e.is_locked = FALSE`;
    }

    // FIXED: Order by `start_time` instead of the non-existent `scheduled_time`.
    query += ` ORDER BY e.start_time DESC, e.title ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching exams:", error);
    res.status(500).json({ error: "Failed to fetch exams." });
  }
});

// GET /api/exams/:id - Fetch a single exam by ID with its sections and questions
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await getExamWithSectionsAndQuestions(id);

    if (!exam) {
      return res.status(404).json({ error: "Exam not found." });
    }

    // Authorization check: Only admin, or the teacher who created it, or a student allowed to take it
    const requestingUser = req.user;
    if (!requestingUser.is_admin && requestingUser.id !== exam.created_by && requestingUser.role !== 'student') {
        return res.status(403).json({ error: "Access denied. You do not have permission to view this exam." });
    }
    // If student, check if exam is locked
    if (requestingUser.role === 'student' && exam.is_locked) {
        return res.status(403).json({ error: "This exam is currently locked and cannot be viewed." });
    }


    res.json(exam);
  } catch (error) {
    console.error("Error fetching exam by ID:", error);
    res.status(500).json({ error: "Failed to fetch exam." });
  }
});

// POST /api/exams - Create a new exam

// FIXED: POST /api/exams - Create a new exam
router.post("/", auth, (req, res, next) => {
    if (!req.user || (!req.user.is_admin && req.user.role !== 'teacher')) {
        return res.status(403).json({ error: "Access denied." });
    }
    next();
}, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FIXED: Replaced `scheduled_time` with `start_time` and `end_time`.
    const {
      title, subject_id, class_level_id, exam_type, duration_minutes,
      pass_mark, max_score, term, session, start_time, end_time, is_locked, sections
    } = req.body;

    if (!title || !subject_id || !class_level_id || !exam_type || !duration_minutes || pass_mark === undefined || !max_score || !term || !session || !sections || sections.length === 0) {
      return res.status(400).json({ error: "Missing required exam fields or sections." });
    }

    const created_by = req.user.id;
    // IMPROVEMENT: Add a 'sections' JSONB column to store the exam structure for later review.
    // This fixes the "column e.sections does not exist" error in the results routes.
    const examResult = await client.query(
      `INSERT INTO exams (title, subject_id, class_level_id, exam_type, duration_minutes, pass_mark, max_score, term, session, start_time, end_time, is_locked, created_by, sections)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING exam_id`,
      [title, subject_id, class_level_id, exam_type, duration_minutes, pass_mark, max_score, term, session, start_time, end_time, is_locked, created_by, JSON.stringify(sections)]
    );
    const examId = examResult.rows[0].exam_id;

    for (const section of sections) {
      const sectionResult = await client.query(
        `INSERT INTO exam_sections (exam_id, section_name, section_instructions, section_order)
         VALUES ($1, $2, $3, $4) RETURNING section_id`,
        [examId, section.section_name, section.section_instructions, section.section_order]
      );
      const sectionId = sectionResult.rows[0].section_id;

      for (const question of section.questions) {
        // Include 'marks' in the INSERT statement for questions
        await client.query(
          `INSERT INTO questions (section_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [sectionId, question.question_text, question.options.A, question.options.B, question.options.C, question.options.D, question.correct_answer, question.explanation, question.marks]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: "Exam created successfully!", examId: examId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error creating exam:", error);
    res.status(500).json({ error: "Failed to create exam: " + error.message });
  } finally {
    client.release();
  }
});

// FIXED: PUT /api/exams/:id - Update an existing exam
router.put("/:id", auth, (req, res, next) => {
    if (!req.user || (!req.user.is_admin && req.user.role !== 'teacher')) {
        return res.status(403).json({ error: "Access denied." });
    }
    next();
}, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    // FIXED: Replaced `scheduled_time` with `start_time` and `end_time`.
    const {
      title, subject_id, class_level_id, exam_type, duration_minutes,
      pass_mark, max_score, term, session, start_time, end_time, is_locked, sections
    } = req.body;

    const examCheck = await client.query(`SELECT created_by FROM exams WHERE exam_id = $1`, [id]);
    if (examCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Exam not found." });
    }
    if (!req.user.is_admin && req.user.id !== examCheck.rows[0].created_by) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: "Access denied." });
    }

    // FIXED: Update query with correct time fields and the new 'sections' JSONB column.
    await client.query(
      `UPDATE exams SET
         title = $1, subject_id = $2, class_level_id = $3, exam_type = $4,
         duration_minutes = $5, pass_mark = $6, max_score = $7, term = $8,
         session = $9, start_time = $10, end_time = $11, is_locked = $12, sections = $13, updated_at = NOW()
       WHERE exam_id = $14`,
      [title, subject_id, class_level_id, exam_type, duration_minutes, pass_mark, max_score, term, session, start_time, end_time, is_locked, JSON.stringify(sections), id]
    );

    await client.query(`DELETE FROM questions WHERE section_id IN (SELECT section_id FROM exam_sections WHERE exam_id = $1)`, [id]);
    await client.query(`DELETE FROM exam_sections WHERE exam_id = $1`, [id]);

    for (const section of sections) {
      const sectionResult = await client.query(
        `INSERT INTO exam_sections (exam_id, section_name, section_instructions, section_order)
         VALUES ($1, $2, $3, $4) RETURNING section_id`,
        [id, section.section_name, section.section_instructions, section.section_order]
      );
      const sectionId = sectionResult.rows[0].section_id;
      for (const question of section.questions) {
        // Include 'marks' in the INSERT statement for questions
        await client.query(
          `INSERT INTO questions (section_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [sectionId, question.question_text, question.options.A, question.options.B, question.options.C, question.options.D, question.correct_answer, question.explanation, question.marks]
        );
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: "Exam updated successfully!", examId: id });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error updating exam:", error);
    res.status(500).json({ error: "Failed to update exam: " + error.message });
  } finally {
    client.release();
  }
});
// DELETE /api/exams/:id - Delete an exam
router.delete("/:id", auth, (req, res, next) => {
    // Middleware to ensure only admins or teachers can access this route
    if (!req.user || (!req.user.is_admin && req.user.role !== 'teacher')) {
        return res.status(403).json({ error: "Access denied. Admin or Teacher privileges required." });
    }
    next();
}, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction

    const { id } = req.params;

    // Fetch the exam to check ownership before allowing deletion
    const examCheck = await client.query(`SELECT created_by FROM exams WHERE exam_id = $1`, [id]);
    if (examCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Exam not found." });
    }
    const examCreatorId = examCheck.rows[0].created_by;

    // Authorization: Only admin or the original creator can delete
    if (!req.user.is_admin && req.user.id !== examCreatorId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: "Access denied. You do not have permission to delete this exam." });
    }

    // Delete associated questions first
    await client.query(`DELETE FROM questions WHERE section_id IN (SELECT section_id FROM exam_sections WHERE exam_id = $1)`, [id]);
    // Delete associated exam sections
    await client.query(`DELETE FROM exam_sections WHERE exam_id = $1`, [id]);
    // Delete associated exam results
    await client.query(`DELETE FROM exam_results WHERE exam_id = $1`, [id]);

    // Finally, delete the exam itself
    const deleteResult = await client.query(`DELETE FROM exams WHERE exam_id = $1`, [id]);

    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Exam not found." });
    }

    await client.query('COMMIT');
    res.status(200).json({ message: "Exam deleted successfully." });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error deleting exam:", error);
    res.status(500).json({ error: "Failed to delete exam: " + error.message });
  } finally {
    client.release();
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

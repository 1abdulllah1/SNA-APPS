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
        `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation
         FROM questions WHERE section_id = $1 ORDER BY question_id ASC`,
        [sectionRow.section_id]
      );

      // Map options to an object for easier frontend handling
      const questions = questionsResult.rows.map(q => ({
          question_id: q.question_id,
          question_text: q.question_text,
          options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
          correct_answer: q.correct_answer,
          explanation: q.explanation
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

        // Total questions answered
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


// GET /api/exams - Fetch all exams with filters
// ENHANCEMENT: Added a LEFT JOIN to 'exam_results' to fetch the 'result_id' if the student has already taken the exam.
// This allows the "View Score" button to appear correctly on the dashboard for teachers/admins.
router.get('/', auth, async (req, res) => {
  try {
    const { subject_id, class_level_id, term, session, exam_type } = req.query;
    const studentId = req.user.id; // Get current user's ID for the join

    let query = `
      SELECT e.exam_id, e.title, e.duration_minutes, e.pass_mark, e.max_score, e.exam_type, e.term, e.session, 
             e.start_time, e.end_time, e.is_locked, e.created_at, e.updated_at, e.created_by,
             s.name as subject_name, cl.level_name as class_level_name,
             er.result_id
      FROM exams e
      LEFT JOIN subjects s ON e.subject_id = s.subject_id
      LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
      LEFT JOIN exam_results er ON e.exam_id = er.exam_id AND er.student_id = $1
      WHERE 1=1
    `;
    const params = [studentId];
    let paramIndex = 2; // Start params from $2 since $1 is the studentId

    if (subject_id) {
      query += ` AND e.subject_id = $${paramIndex++}`;
      params.push(subject_id);
    }
    if (class_level_id) {
      query += ` AND e.class_level_id = $${paramIndex++}`;
      params.push(class_level_id);
    }
    if (term) {
      query += ` AND e.term = $${paramIndex++}`;
      params.push(term);
    }
    if (session) {
      query += ` AND e.session = $${paramIndex++}`;
      params.push(session);
    }
    if (exam_type) {
      query += ` AND e.exam_type = $${paramIndex++}`;
      params.push(exam_type);
    }
    query += ` ORDER BY e.start_time DESC, e.created_at DESC`;

    const exams = await pool.query(query, params);
    res.json(exams.rows);
  } catch (error) {
    console.error("Error fetching exams:", error);
    res.status(500).json({ error: "Failed to fetch exams." });
  }
});


// GET /api/exams/:id - Fetch a single exam by ID with all its sections and questions
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await getExamWithSectionsAndQuestions(id);
    if (!exam) {
      return res.status(404).json({ error: "Exam not found." });
    }
    res.json(exam);
  } catch (error) {
    // The 'id' is correctly scoped here, so the ReferenceError was likely due to the route order.
    console.error(`Error fetching exam ${id}:`, error); 
    res.status(500).json({ error: "Failed to fetch exam details." });
  }
});


// POST /api/exams - Create a new exam (Admin or Teacher only)
// FIX: Handles 'scheduled_time' from the frontend and correctly calculates 'start_time' and 'end_time'.
router.post('/', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction

    const {
      title, subject_id, class_level_id, exam_type, duration_minutes,
      pass_mark, max_score, term, session, scheduled_time, is_locked, sections
    } = req.body;

    // Authorization: Only admin or teacher can create exams
    if (!req.user.is_admin && req.user.role !== 'teacher') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: "Access denied. Admin or Teacher privileges required." });
    }

    // Input validation
    if (!title || !subject_id || !class_level_id || !exam_type || !duration_minutes ||
        pass_mark === undefined || !max_score || !term || !session || !sections || sections.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "Missing required exam fields or sections." });
    }

    // --- Time Calculation Logic ---
    const start_time = scheduled_time ? new Date(scheduled_time) : new Date();
    const end_time = new Date(start_time.getTime() + duration_minutes * 60000);

    // Insert exam
    const examResult = await client.query(
      `INSERT INTO exams (title, subject_id, class_level_id, exam_type, duration_minutes, pass_mark, max_score, term, session, start_time, end_time, is_locked, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING exam_id`,
      [title, subject_id, class_level_id, exam_type, duration_minutes, pass_mark, max_score, term, session, start_time, end_time, is_locked, req.user.id]
    );
    const examId = examResult.rows[0].exam_id;

    // Insert sections and questions
    for (const section of sections) {
      const sectionResult = await client.query(
        `INSERT INTO exam_sections (exam_id, section_name, section_instructions, section_order)
         VALUES ($1, $2, $3, $4) RETURNING section_id`,
        [examId, section.section_name, section.section_instructions, section.section_order]
      );
      const sectionId = sectionResult.rows[0].section_id;

      for (const question of section.questions) {
        await client.query(
          `INSERT INTO questions (exam_id, section_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            examId, sectionId, question.question_text,
            question.options.A, question.options.B, question.options.C, question.options.D,
            question.correct_answer, question.explanation
          ]
        );
      }
    }

    await client.query('COMMIT'); // Commit transaction
    res.status(201).json({ message: "Exam created successfully!", examId: examId });

  } catch (error) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error("Error creating exam:", error);
    res.status(500).json({ error: "Failed to create exam." });
  } finally {
    client.release();
  }
});


// PUT /api/exams/:id - Update an exam (Admin or Teacher only)
// FIX: Similar to the create route, this now handles 'start_time' and 'end_time' correctly.
router.put('/:id', auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        const { id } = req.params;
        const {
            title, subject_id, class_level_id, exam_type, duration_minutes,
            pass_mark, max_score, term, session, scheduled_time, is_locked, sections
        } = req.body;

        // Authorization: Only admin or teacher can update exams
        if (!req.user.is_admin && req.user.role !== 'teacher') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Access denied. Admin or Teacher privileges required." });
        }

        // Input validation
        if (!title || !subject_id || !class_level_id || !exam_type || !duration_minutes ||
            pass_mark === undefined || !max_score || !term || !session || !sections) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Missing required exam fields or sections." });
        }

        // --- Time Calculation Logic ---
        const start_time = scheduled_time ? new Date(scheduled_time) : new Date();
        const end_time = new Date(start_time.getTime() + duration_minutes * 60000);

        // Update exam details
        await client.query(
            `UPDATE exams SET title = $1, subject_id = $2, class_level_id = $3, exam_type = $4,
                            duration_minutes = $5, pass_mark = $6, max_score = $7, term = $8, session = $9,
                            start_time = $10, end_time = $11, is_locked = $12, updated_at = NOW()
             WHERE exam_id = $13`,
            [title, subject_id, class_level_id, exam_type, duration_minutes, pass_mark, max_score, term, session, start_time, end_time, is_locked, id]
        );

        // --- Sophisticated Section & Question Handling ---
        // 1. Get existing sections and questions for this exam
        const existingSectionsResult = await client.query(`SELECT section_id FROM exam_sections WHERE exam_id = $1`, [id]);
        const existingSectionIds = existingSectionsResult.rows.map(row => row.section_id);

        const existingQuestionsResult = await client.query(`SELECT question_id FROM questions WHERE exam_id = $1`, [id]);
        const existingQuestionIds = existingQuestionsResult.rows.map(row => row.question_id);

        const incomingSectionIds = sections.filter(s => s.section_id && !String(s.section_id).startsWith('new-')).map(s => s.section_id);
        const incomingQuestionIds = sections.flatMap(s => s.questions).filter(q => q.question_id && !String(q.question_id).startsWith('new-')).map(q => q.question_id);

        // 2. Delete sections that are no longer present in the incoming data
        const sectionsToDelete = existingSectionIds.filter(sectionId => !incomingSectionIds.includes(sectionId));
        if (sectionsToDelete.length > 0) {
            await client.query(`DELETE FROM questions WHERE section_id = ANY($1::int[])`, [sectionsToDelete]);
            await client.query(`DELETE FROM exam_sections WHERE section_id = ANY($1::int[])`, [sectionsToDelete]);
        }

        // 3. Delete questions that are no longer present
        const questionsToDelete = existingQuestionIds.filter(questionId => !incomingQuestionIds.includes(questionId));
        if (questionsToDelete.length > 0) {
            await client.query(`DELETE FROM questions WHERE question_id = ANY($1::int[])`, [questionsToDelete]);
        }

        // 4. Upsert (Insert/Update) sections and questions
        for (const [index, section] of sections.entries()) {
            let sectionId;
            if (section.section_id && !String(section.section_id).startsWith('new-')) { // Existing section
                sectionId = section.section_id;
                await client.query(
                    `UPDATE exam_sections SET section_name = $1, section_instructions = $2, section_order = $3
                     WHERE section_id = $4`,
                    [section.section_name, section.section_instructions, index + 1, sectionId]
                );
            } else { // New section
                const newSectionResult = await client.query(
                    `INSERT INTO exam_sections (exam_id, section_name, section_instructions, section_order)
                     VALUES ($1, $2, $3, $4) RETURNING section_id`,
                    [id, section.section_name, section.section_instructions, index + 1]
                );
                sectionId = newSectionResult.rows[0].section_id;
            }

            for (const question of section.questions) {
                if (question.question_id && !String(question.question_id).startsWith('new-')) { // Existing question
                    await client.query(
                        `UPDATE questions SET question_text = $1, option_a = $2, option_b = $3, option_c = $4, option_d = $5, correct_answer = $6, explanation = $7
                         WHERE question_id = $8`,
                        [
                            question.question_text, question.options.A, question.options.B, question.options.C, question.options.D,
                            question.correct_answer, question.explanation, question.question_id
                        ]
                    );
                } else { // New question
                    await client.query(
                        `INSERT INTO questions (exam_id, section_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [
                            id, sectionId, question.question_text,
                            question.options.A, question.options.B, question.options.C, question.options.D,
                            question.correct_answer, question.explanation
                        ]
                    );
                }
            }
        }

        await client.query('COMMIT'); // Commit transaction
        res.status(200).json({ message: "Exam updated successfully!", examId: id });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error("Error updating exam:", error);
        res.status(500).json({ error: "Failed to update exam." });
    } finally {
        client.release();
    }
});


// DELETE /api/exams/:id - Delete an exam (Admin or Teacher only)
router.delete('/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    // Authorization: Only admin or teacher can delete exams
    if (!req.user.is_admin && req.user.role !== 'teacher') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: "Access denied. Admin or Teacher privileges required." });
    }

    // Check for existing exam results before deleting the exam
    const resultsCheck = await client.query("SELECT 1 FROM exam_results WHERE exam_id = $1 LIMIT 1", [id]);
    if (resultsCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "Cannot delete exam: there are submitted results for this exam. Please delete results first." });
    }
    
    // Also delete from exam_sessions
    await client.query("DELETE FROM exam_sessions WHERE exam_id = $1", [id]);
    // Delete questions associated with the exam
    await client.query("DELETE FROM questions WHERE exam_id = $1", [id]);
    // Delete sections associated with the exam
    await client.query("DELETE FROM exam_sections WHERE exam_id = $1", [id]);
    // Delete the exam itself
    const deleteResult = await client.query("DELETE FROM exams WHERE exam_id = $1", [id]);

    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Exam not found." });
    }

    await client.query('COMMIT');
    res.status(200).json({ message: "Exam deleted successfully." });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error deleting exam:", error);
    res.status(500).json({ error: "Failed to delete exam." });
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

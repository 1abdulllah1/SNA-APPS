const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const auth = require('../middlewares/auth');

// Helper function to get full exam details, ensuring a consistent data structure
async function getExamWithQuestions(examId) {
  const examResult = await pool.query(
    `SELECT e.*, s.name as subject_name 
     FROM exams e 
     LEFT JOIN subjects s ON e.subject_id = s.subject_id
     WHERE e.exam_id = $1`,
    [examId]
  );
  if (examResult.rows.length === 0) return null;
  const examData = examResult.rows[0];

  const questionsResult = await pool.query(
    `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks
     FROM questions WHERE exam_id = $1 ORDER BY question_id ASC`,
    [examId]
  );

  // This structure is now used by both edit-exam.html and exam.html
  examData.questions = questionsResult.rows.map(q => ({
    question_id: q.question_id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    marks: q.marks
  }));
  return examData;
}

// CREATE EXAM
router.post("/", auth, async (req, res) => {
  if (req.user.role !== 'teacher' && !req.user.is_admin) {
    return res.status(403).json({ error: "Only teachers or admins can create exams." });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, description, duration_minutes, class_level, questions, 
            subject_id, exam_type, max_score, term, session, is_locked } = req.body;
            
    if (!title || !duration_minutes || !class_level || !subject_id || !exam_type || !max_score || !term || !session) {
        throw new Error("Missing required exam details. Please fill all required fields.");
    }
    
    // Insert exam details, including the new `is_locked` field
    const examResult = await client.query(
      `INSERT INTO exams (title, description, duration_minutes, created_by, class_level, subject_id, exam_type, max_score, term, session, is_locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [title, description, parseInt(duration_minutes), req.user.id, class_level, parseInt(subject_id), exam_type.toUpperCase(), parseInt(max_score), term.toUpperCase(), session, !!is_locked]
    );
    const examId = examResult.rows[0].exam_id;
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        throw new Error("An exam must have at least one question.");
    }
    
    // **FIXED**: This logic now correctly parses the question data object from the frontend
    for (const q of questions) {
      if (!q.question_text || !q.options || !q.options.A || !q.options.B || !q.options.C || !q.options.D || !q.correct_answer || q.marks === undefined) {
        throw new Error(`Invalid data for question: "${q.question_text || 'Untitled'}". Ensure all fields are present.`);
      }
      await client.query(
        `INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [examId, q.question_text, q.options.A, q.options.B, q.options.C, q.options.D, q.correct_answer.toUpperCase(), q.explanation, parseInt(q.marks) || 1]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json(examResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Exam creation error:", error);
    res.status(400).json({ error: error.message || "Exam creation failed." });
  } finally {
    client.release();
  }
});


// UPDATE EXAM
router.put("/:examId", auth, async (req, res) => {
  const { examId } = req.params;
  const { id: userId, is_admin: isAdmin } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, description, duration_minutes, class_level, questions, 
            subject_id, exam_type, max_score, term, session, is_locked } = req.body;
    
    const examOwnerResult = await client.query("SELECT created_by FROM exams WHERE exam_id = $1", [examId]);
    if (examOwnerResult.rows.length === 0) throw new Error("Exam not found");
    if (!isAdmin && examOwnerResult.rows[0].created_by !== userId) throw new Error("Not authorized to update this exam");

    if (!title || !duration_minutes || !class_level || !subject_id || !exam_type || !max_score || !term || !session) {
        throw new Error("Missing required exam details for update.");
    }
    
    // Update the exam, including the `is_locked` status
    await client.query(
      `UPDATE exams 
       SET title = $1, description = $2, duration_minutes = $3, class_level = $4, 
           subject_id = $5, exam_type = $6, max_score = $7, term = $8, session = $9, 
           is_locked = $10, updated_at = CURRENT_TIMESTAMP
       WHERE exam_id = $11`,
      [title, description, parseInt(duration_minutes), class_level, parseInt(subject_id), exam_type.toUpperCase(), parseInt(max_score), term.toUpperCase(), session, !!is_locked, examId]
    );

    if (questions && Array.isArray(questions)) {
      await client.query('DELETE FROM questions WHERE exam_id = $1', [examId]);
      for (const q of questions) {
        if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_answer || q.marks === undefined) {
           throw new Error(`Invalid update data for question: "${q.question_text || 'Untitled'}"`);
        }
        await client.query(
          `INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [examId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer.toUpperCase(), q.explanation, parseInt(q.marks) || 1]
        );
      }
    }
    
    await client.query('COMMIT');
    const updatedExamData = await getExamWithQuestions(examId);
    res.json(updatedExamData);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Exam update error:", error);
    res.status(400).json({ error: error.message || "Exam update failed." });
  } finally {
    client.release();
  }
});


// DELETE EXAM
router.delete("/:examId", auth, async (req, res) => {
  const { examId } = req.params;
  const { id: userId, is_admin: isAdmin } = req.user;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const examResult = await client.query("SELECT created_by FROM exams WHERE exam_id = $1", [examId]);
    if (examResult.rows.length === 0) throw new Error("Exam not found");
    if (!isAdmin && examResult.rows[0].created_by !== userId) throw new Error("Not authorized to delete this exam.");

    // **FIXED**: Manually delete from all dependent tables first.
    // This order is critical if you don't use ON DELETE CASCADE in the DB.
    await client.query("DELETE FROM exam_sessions WHERE exam_id = $1", [examId]);
    await client.query("DELETE FROM exam_results WHERE exam_id = $1", [examId]);
    await client.query("DELETE FROM questions WHERE exam_id = $1", [examId]);
    // Finally, delete the exam itself
    const deleteExamResult = await client.query("DELETE FROM exams WHERE exam_id = $1", [examId]);
    
    if (deleteExamResult.rowCount === 0) {
        throw new Error("Exam deletion failed unexpectedly.");
    }

    await client.query('COMMIT');
    res.status(200).json({ message: "Exam and all associated data deleted successfully" });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Delete exam error:", error);
    const statusCode = error.message.includes("Not authorized") ? 403 : error.message.includes("not found") ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to delete exam" });
  } finally {
    client.release();
  }
});


// GET ALL EXAMS
router.get("/", auth, async (req, res) => {
    try {
        const { id: userId, role: userRole, is_admin: isAdmin } = req.user;
        const { class_level: classLevelQuery } = req.query;

        // **IMPROVEMENT**: Added `is_locked` to the SELECT statement
        let queryText = `SELECT e.*, s.name as subject_name FROM exams e LEFT JOIN subjects s ON e.subject_id = s.subject_id`;
        let params = [];
        let conditions = [];

        if (isAdmin) {
            if (classLevelQuery) {
                conditions.push(`e.class_level = $${params.length + 1}`);
                params.push(classLevelQuery);
            }
        } else if (userRole === 'student') {
            const userResult = await pool.query("SELECT class_level FROM users WHERE id = $1", [userId]);
            const studentClassLevel = userResult.rows.length ? userResult.rows[0].class_level : null;
            const effectiveClassLevel = classLevelQuery || studentClassLevel;
            if (effectiveClassLevel) {
                // Students should see exams for their class or for 'Any' class
                conditions.push(`(e.class_level = $${params.length + 1} OR e.class_level = 'Any')`);
                params.push(effectiveClassLevel);
            } else {
                return res.json([]); // Student without a class level sees no exams.
            }
        } else if (userRole === 'teacher') {
            conditions.push(`e.created_by = $${params.length + 1}`);
            params.push(userId);
        } else {
            return res.json([]); // Should not happen
        }

        if (conditions.length > 0) {
            queryText += " WHERE " + conditions.join(" AND ");
        }
        
        queryText += " ORDER BY e.created_at DESC";
        
        const result = await pool.query(queryText, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Fetch exams error:", error);
        res.status(500).json({ error: "Failed to fetch exams" });
    }
});


// GET ALL SUBJECTS (for dropdowns)
router.get("/config/subjects", auth, async (req, res) => {
    try {
        const subjects = await pool.query("SELECT subject_id, name, subject_code FROM subjects ORDER BY name ASC");
        res.json(subjects.rows);
    } catch (error) {
        console.error("Error fetching subjects:", error);
        res.status(500).json({ error: "Failed to fetch subjects" });
    }
});


// GET SINGLE EXAM (with questions)
router.get("/:examId", auth, async (req, res) => {
    try {
        const { examId } = req.params;
        if (isNaN(parseInt(examId))) return res.status(400).json({ error: "Invalid Exam ID format." });
        const examData = await getExamWithQuestions(examId);
        if (!examData) return res.status(404).json({ error: "Exam not found" });
        res.json(examData);
    } catch (error) {
        console.error("Fetch single exam error:", error);
        res.status(500).json({ error: "Failed to fetch exam details" });
    }
});

module.exports = router;


const pool = require("../database/db");

exports.addQuestion = async (req, res) => {
  try {
    const { examId } = req.params;
    const { question_text, option_a, option_b, option_c, option_d, correct_answer } = req.body;
    const userId = req.user.id;

    // Verify exam ownership
    const exam = await pool.query(
      "SELECT created_by FROM exams WHERE exam_id = $1",
      [examId]
    );
    
    if (exam.rows[0].created_by !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Add question
    const result = await pool.query(
      `INSERT INTO questions 
       (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [examId, question_text, option_a, option_b, option_c, option_d, correct_answer]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add question" });
  }
};
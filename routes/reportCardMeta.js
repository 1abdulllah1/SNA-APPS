// routes/reportCardMeta.js
const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const auth = require('../middlewares/auth');

// Middleware to ensure only admins or teachers can access these routes for CUD (Create, Update, Delete)
const isAdminOrTeacher = (req, res, next) => {
  if (!req.user || (!req.user.is_admin && req.user.role !== 'teacher')) {
    return res.status(403).json({ error: "Access denied. Admin or Teacher privileges required." });
  }
  next();
};

/**
 * @route GET /api/report-card-meta/:studentId/:term/:session
 * @description Fetch a specific report card metadata entry for a student, term, and session.
 * @access Admin (or student themselves for their own data)
 * @param {string} studentId - The ID of the student.
 * @param {string} term - The academic term (e.g., 'FIRST', 'SECOND', 'THIRD').
 * @param {string} session - The academic session (e.g., '2023/2024').
 */
router.get('/:studentId/:term/:session', auth, async (req, res) => {
  const { studentId, term, session } = req.params;

  // Authorize: Admin can view any, student can only view their own, teachers can view students in their classes (if implemented)
  // For simplicity, currently: Admin can view any, student can only view their own
  if (req.user.id !== parseInt(studentId) && !req.user.is_admin) {
    return res.status(403).json({ error: "Access denied. You can only view your own report card meta." });
  }

  try {
    const metaQuery = await pool.query(
      "SELECT * FROM report_card_meta WHERE student_id = $1 AND term = $2 AND session = $3",
      [studentId, term.toUpperCase(), session]
    );
    if (metaQuery.rows.length === 0) {
      return res.status(404).json({ error: "Report card meta data not found for this student, term, and session." });
    }
    res.json(metaQuery.rows[0]);
  } catch (error) {
    console.error("Error fetching report card meta:", error);
    res.status(500).json({ error: "Failed to fetch report card meta data." });
  }
});

/**
 * @route POST /api/report-card-meta
 * @description Save or update report card metadata. Admin or Teacher only.
 * @access AdminOrTeacher
 * @body {number} studentId - The ID of the student.
 * @body {string} term - The academic term (e.g., 'FIRST', 'SECOND', 'THIRD').
 * @body {string} session - The academic session (e.g., '2023/2024').
 * @body {string} classLevel - The class level for which the report is generated.
 * @body {string} [teacherComment] - Optional comment from the teacher.
 * @body {string} [principalComment] - Optional comment from the principal.
 * @body {string} [nextTermBegins] - Optional date for next term's resumption.
 * @body {Array} [cumulativeData] - JSON array of cumulative scores for subjects.
 */
router.post("/", auth, isAdminOrTeacher, async (req, res) => { // Changed isAdmin to isAdminOrTeacher
    const { studentId, term, session, teacherComment, principalComment, nextTermBegins, cumulativeData, classLevel } = req.body;
    if (!studentId || !term || !session || !classLevel) {
        return res.status(400).json({ error: "Missing required identifiers (studentId, term, session, classLevel)." });
    }
    try {
        const query = `
            INSERT INTO report_card_meta (student_id, term, session, class_level, teacher_comment, principal_comment, next_term_begins, cumulative_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (student_id, term, session)
            DO UPDATE SET
                class_level = EXCLUDED.class_level,
                teacher_comment = EXCLUDED.teacher_comment,
                principal_comment = EXCLUDED.principal_comment,
                next_term_begins = EXCLUDED.next_term_begins,
                cumulative_data = EXCLUDED.cumulative_data,
                updated_at = NOW()
            RETURNING *;
        `;
        const result = await pool.query(query, [
            studentId,
            term.toUpperCase(), // Ensure term is uppercase for consistency
            session,
            classLevel,
            teacherComment || null,
            principalComment || null,
            nextTermBegins || null,
            cumulativeData ? JSON.stringify(cumulativeData) : null // Store cumulativeData as JSON string
        ]);
        res.status(200).json({ message: "Report card data saved successfully.", data: result.rows[0] });
    } catch (error) {
        console.error("Error saving report meta:", error);
        res.status(500).json({ error: "Failed to save report card data. " + error.message });
    }
});

/**
 * @route DELETE /api/report-card-meta/:studentId/:term/:session
 * @description Delete a specific report card metadata entry. Admin or Teacher only.
 * @access AdminOrTeacher
 * @param {string} studentId - The ID of the student.
 * @param {string} term - The academic term.
 * @param {string} session - The academic session.
 */
router.delete('/:studentId/:term/:session', auth, isAdminOrTeacher, async (req, res) => { // Changed isAdmin to isAdminOrTeacher
  const { studentId, term, session } = req.params;
  try {
    const deleteResult = await pool.query(
      "DELETE FROM report_card_meta WHERE student_id = $1 AND term = $2 AND session = $3",
      [studentId, term.toUpperCase(), session]
    );
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Report card meta data not found to delete." });
    }
    res.status(200).json({ message: "Report card meta data deleted successfully." });
  } catch (error) {
    console.error("Error deleting report card meta:", error);
    res.status(500).json({ error: "Failed to delete report card meta data." });
  }
});


module.exports = router;

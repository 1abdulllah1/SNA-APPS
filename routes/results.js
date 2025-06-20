const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const auth = require("../middlewares/auth");

/**
 * --- GLOBAL FIXES & ENHANCEMENTS ---
 * 1.  Standardized Logout: A single, reliable logout function is now used across all pages.
 * 2.  Correct Result Fetching: The logic to get results for students and teachers is now distinct and correct.
 * 3.  "User Not Found" Error: This is fixed by correctly using the authenticated user's ID (`req.user.id`).
 * 4.  Dashboard Date: The query for dashboard results now correctly fetches `submission_date`.
 * 5.  New Report Card Engine: A powerful new endpoint `/compile-report` does all the heavy lifting for report cards.
 * 6.  Report Card Saving: New endpoints to get and save editable report card data (comments, etc.).
 */

// #region --- Helper Functions ---

// Helper function to get grade and remark based on percentage
function getGradeAndRemark(percentage) {
    if (isNaN(percentage)) return { grade: 'N/A', remark: 'N/A' };
    const p = Math.round(percentage);
    if (p >= 75) return { grade: 'A1', remark: 'Distinction' };
    if (p >= 70) return { grade: 'B2', remark: 'Excellent' };
    if (p >= 65) return { grade: 'B3', remark: 'Very Good' };
    if (p >= 60) return { grade: 'C4', remark: 'Good' };
    if (p >= 55) return { grade: 'C5', remark: 'Credit' };
    if (p >= 50) return { grade: 'C6', remark: 'Pass' };
    if (p >= 45) return { grade: 'D7', remark: 'Pass' };
    if (p >= 40) return { grade: 'E8', remark: 'Fair' };
    return { grade: 'F9', remark: 'Fail' };
}
// #endregion

// #region --- Main API Routes ---

/**
 * ROUTE: GET /api/exam-results/
 * PURPOSE: Gets a simple list of results for the logged-in student's dashboard.
 * FIX: Now correctly selects `submission_date` to fix the "N/A" issue on the dashboard.
 */
router.get("/", auth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.result_id, e.exam_id, e.title AS exam_title, r.submission_date, r.score
            FROM exam_results r
            JOIN exams e ON e.exam_id = r.exam_id
            WHERE r.student_id = $1
            ORDER BY r.submission_date DESC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        console.error("Results fetch error:", error);
        res.status(500).json({ error: "Failed to fetch your exam results." });
    }
});


/**
 * ROUTE: GET /api/exam-results/:examId
 * PURPOSE: Gets detailed results for a single exam. Handles different views for students vs. teachers/admins.
 * FIX: This route is now robust and correctly authorizes users.
 */
router.get("/:examId", auth, async (req, res) => {
  try {
    const { examId } = req.params;
    const { id: userId, is_admin, role } = req.user;

    const examQuery = await pool.query("SELECT * FROM exams WHERE exam_id = $1", [examId]);
    if (examQuery.rows.length === 0) return res.status(404).json({ error: "Exam not found." });
    const exam = examQuery.rows[0];

    if (role === 'teacher' && !is_admin && exam.created_by !== userId) {
      return res.status(403).json({ error: "You are not authorized to view results for this exam." });
    }

    if (role === 'teacher' || is_admin) {
      const resultsQuery = await pool.query(`
        SELECT r.*, u.first_name, u.last_name, u.admission_number 
        FROM exam_results r JOIN users u ON r.student_id = u.id
        WHERE r.exam_id = $1 ORDER BY r.score DESC`, [examId]
      );

      return res.json({ exam, results: resultsQuery.rows, viewMode: 'teacher' });
    }

    // --- Student View ---
    const studentResultQuery = await pool.query(
      "SELECT * FROM exam_results WHERE exam_id = $1 AND student_id = $2",
      [examId, userId]
    );

    if (studentResultQuery.rows.length === 0) {
      return res.status(404).json({ error: "You have not submitted this exam, or the result is not available." });
    }

    const questionsQuery = await pool.query(
      `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation
       FROM questions WHERE exam_id = $1 ORDER BY question_id ASC`,
      [examId]
    );

    res.json({
      exam: { ...exam, ...studentResultQuery.rows[0] }, // Merge exam info with student's specific result
      questions: questionsQuery.rows,
      viewMode: 'student'
    });

  } catch (error) {
    console.error(`Error fetching results for exam ${req.params.examId}:`, error);
    res.status(500).json({ error: "An internal server error occurred while fetching results." });
  }
});


// **NEW & FIX**: Get ONE specific result by its own ID (for Students)



/**
 * ROUTE: GET /api/exam-results/report/compile
 * PURPOSE: The new report card engine. Aggregates all data for a student's term report.
 * FEATURE: This is the powerhouse for the new report card system.
 */
router.get("/report/compile", auth, async (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: "Access denied." });
    }
    const { studentId, term, session } = req.query;

    if (!studentId || !term || !session) {
        return res.status(400).json({ error: "Student, term, and session are required." });
    }

    try {
        const studentQuery = pool.query("SELECT * FROM users WHERE id = $1", [studentId]);
        const resultsQuery = pool.query(`
            SELECT s.name AS subject_name, e.exam_type, e.max_score, er.raw_score_obtained
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.exam_id
            JOIN subjects s ON e.subject_id = s.subject_id
            WHERE er.student_id = $1 AND e.term = $2 AND e.session = $3
        `, [studentId, term.toUpperCase(), session]);
        
        // Fetch editable metadata from our new table
        const metaQuery = pool.query(
            "SELECT * FROM report_card_meta WHERE student_id = $1 AND term = $2 AND session = $3",
            [studentId, term.toUpperCase(), session]
        );

        const [studentRes, resultsRes, metaRes] = await Promise.all([studentQuery, resultsQuery, metaQuery]);

        if (studentRes.rows.length === 0) {
            return res.status(404).json({ error: "Student not found." });
        }

        // --- Report Card Calculation Logic ---
        const subjects = {};
        resultsRes.rows.forEach(r => {
            if (!subjects[r.subject_name]) {
                subjects[r.subject_name] = { CAs: [], Exam: null };
            }
            if (r.exam_type.startsWith('CA')) {
                subjects[r.subject_name].CAs.push({ score: r.raw_score_obtained, max: r.max_score });
            } else if (r.exam_type === 'MAIN_EXAM') {
                subjects[r.subject_name].Exam = { score: r.raw_score_obtained, max: r.max_score };
            }
        });

        const CA_WEIGHT = 40;
        const EXAM_WEIGHT = 60;
        const processedSubjects = Object.entries(subjects).map(([name, scores]) => {
            const totalCAScore = scores.CAs.reduce((sum, ca) => sum + ca.score, 0);
            const totalCAMax = scores.CAs.reduce((sum, ca) => sum + ca.max, 0);
            const scaledCA = totalCAMax > 0 ? (totalCAScore / totalCAMax) * CA_WEIGHT : 0;

            const examScore = scores.Exam?.score || 0;
            const examMax = scores.Exam?.max || 0;
            const scaledExam = examMax > 0 ? (examScore / examMax) * EXAM_WEIGHT : 0;
            
            const finalScore = scaledCA + scaledExam;
            const gradeInfo = getGradeAndRemark(finalScore);

            return {
                subjectName: name,
                caScore: totalCAScore,
                caMax: totalCAMax,
                examScore: examScore,
                examMax: examMax,
                finalScore: finalScore.toFixed(1),
                grade: gradeInfo.grade,
                remark: gradeInfo.remark
            };
        });
        
        // --- Combine all data ---
        const responsePayload = {
            student: studentRes.rows[0],
            term,
            session,
            subjects: processedSubjects,
            meta: metaRes.rows[0] || {} // Send existing metadata or an empty object
        };

        res.json(responsePayload);

    } catch (error) {
        console.error("Error compiling report card:", error);
        res.status(500).json({ error: "Failed to compile report card data." });
    }
});

/**
 * ROUTE: POST /api/exam-results/report/meta
 * PURPOSE: Saves or updates the editable parts of the report card.
 * FEATURE: Powers the "Save" button in the report card's edit mode.
 */
router.post("/report/meta", auth, async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: "Access denied." });

    const { 
        studentId, term, session, teacherComment, principalComment, 
        nextTermBegins, classPosition, affectiveDomain 
    } = req.body;

    try {
        const query = `
            INSERT INTO report_card_meta (student_id, term, session, teacher_comment, principal_comment, next_term_begins, class_position, affective_domain)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (student_id, term, session) 
            DO UPDATE SET
                teacher_comment = EXCLUDED.teacher_comment,
                principal_comment = EXCLUDED.principal_comment,
                next_term_begins = EXCLUDED.next_term_begins,
                class_position = EXCLUDED.class_position,
                affective_domain = EXCLUDED.affective_domain,
                updated_at = NOW();
        `;
        await pool.query(query, [studentId, term, session, teacherComment, principalComment, nextTermBegins, classPosition, affectiveDomain]);
        res.status(200).json({ message: "Report card data saved successfully." });
    } catch (error) {
        console.error("Error saving report meta:", error);
        res.status(500).json({ error: "Failed to save report card data." });
    }
});

router.get("/by-result/:resultId", auth, async (req, res) => {
    try {
        const { resultId } = req.params;
        const { id: userId, is_admin } = req.user;

        const resultQuery = await pool.query("SELECT * FROM exam_results WHERE result_id = $1", [resultId]);
        if (resultQuery.rows.length === 0) return res.status(404).json({ error: "Result not found." });
        
        const result = resultQuery.rows[0];
        // Security: Ensure the user owns the result or is an admin
        if (result.student_id !== userId && !is_admin) {
             return res.status(403).json({ error: "You are not authorized to view this result." });
        }

        const examQuery = await pool.query("SELECT * FROM exams WHERE exam_id = $1", [result.exam_id]);
        const questionsQuery = await pool.query("SELECT * FROM questions WHERE exam_id = $1", [result.exam_id]);
        
        res.json({
            exam: { ...examQuery.rows[0], ...result },
            questions: questionsQuery.rows,
            viewMode: 'student'
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch detailed result." });
    }
});

module.exports = router;

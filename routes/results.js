const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const auth = require("../middlewares/auth");

// Helper function to get grade and remark based on percentage
function getGradeAndRemark(percentage) {
    if (isNaN(percentage) || percentage === null) return { grade: 'N/A', remark: 'N/A' };
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

/**
 * ROUTE: GET /api/exam-results/
 * Gets a simple list of results for the logged-in student's dashboard.
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
 * Gets detailed results for a single exam for teachers/admins.
 */
router.get("/:examId", auth, async (req, res) => {
  try {
    const { examId } = req.params;
    const { id: userId, is_admin, role } = req.user;

    const examQuery = await pool.query("SELECT * FROM exams WHERE exam_id = $1", [examId]);
    if (examQuery.rows.length === 0) return res.status(404).json({ error: "Exam not found." });
    const exam = examQuery.rows[0];

    // Authorize teacher/admin view
    if (role === 'teacher' || is_admin) {
        if (role === 'teacher' && !is_admin && exam.created_by !== userId) {
            return res.status(403).json({ error: "You are not authorized to view results for this exam." });
        }
        const resultsQuery = await pool.query(`
            SELECT r.*, u.first_name, u.last_name, u.admission_number 
            FROM exam_results r JOIN users u ON r.student_id = u.id
            WHERE r.exam_id = $1 ORDER BY r.score DESC`, [examId]
        );
        return res.json({ exam, results: resultsQuery.rows, viewMode: 'teacher' });
    } else {
        return res.status(403).json({ error: "Access denied." });
    }

  } catch (error) {
    console.error(`Error fetching results for exam ${req.params.examId}:`, error);
    res.status(500).json({ error: "An internal server error occurred while fetching results." });
  }
});


/**
 * ROUTE: GET /api/exam-results/report/compile
 * The report card engine. Aggregates all data for a student's term report.
 */
router.get("/report/compile", auth, async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: "Access denied." });
    const { studentId, term, session } = req.query;
    if (!studentId || !term || !session) return res.status(400).json({ error: "Student, term, and session are required." });

    const client = await pool.connect();
    try {
        const studentQuery = client.query("SELECT * FROM users WHERE id = $1 AND role = 'student'", [studentId]);
        const resultsQuery = client.query(`
            SELECT s.name AS subject_name, e.exam_type, er.raw_score_obtained, er.total_possible_marks
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.exam_id
            JOIN subjects s ON e.subject_id = s.subject_id
            WHERE er.student_id = $1 AND e.term = $2 AND e.session = $3
        `, [studentId, term.toUpperCase(), session]);
        
        const prevTerms = term.toUpperCase() === 'SECOND' ? ['FIRST'] : term.toUpperCase() === 'THIRD' ? ['FIRST', 'SECOND'] : [];
        const prevResultsQuery = prevTerms.length > 0
            ? client.query("SELECT term, cumulative_data FROM report_card_meta WHERE student_id = $1 AND session = $2 AND term = ANY($3::text[])", [studentId, session, prevTerms])
            : Promise.resolve({ rows: [] });

        const metaQuery = client.query("SELECT * FROM report_card_meta WHERE student_id = $1 AND term = $2 AND session = $3", [studentId, term.toUpperCase(), session]);
        
        const [studentRes, resultsRes, metaRes, prevResultsRes] = await Promise.all([studentQuery, resultsQuery, metaQuery, prevResultsQuery]);

        if (studentRes.rows.length === 0) throw new Error("Student not found.");

        const subjectsData = {};
        resultsRes.rows.forEach(r => {
            if (!subjectsData[r.subject_name]) subjectsData[r.subject_name] = { CAs: [], Exam: null };
            const result = { score: r.raw_score_obtained, max: r.total_possible_marks };
            if (r.exam_type.startsWith('CA') || r.exam_type === 'MID_TERM') {
                subjectsData[r.subject_name].CAs.push(result);
            } else if (r.exam_type === 'MAIN_EXAM') {
                subjectsData[r.subject_name].Exam = result;
            }
        });

        const previousTermScores = {};
        if(prevResultsRes.rows.length > 0) {
            prevResultsRes.rows.forEach(row => {
                // The cumulative_data is expected to be a JSON array of objects
                const termData = (typeof row.cumulative_data === 'string') ? JSON.parse(row.cumulative_data) : row.cumulative_data;
                if (termData) {
                    termData.forEach(subject => {
                        if (!previousTermScores[subject.subjectName]) previousTermScores[subject.subjectName] = {};
                        previousTermScores[subject.subjectName][row.term] = subject.finalScore;
                    });
                }
            });
        }
        
        const CA_WEIGHT = 40;
        const EXAM_WEIGHT = 60;
        const processedSubjects = Object.entries(subjectsData).map(([name, scores]) => {
            const totalCAScore = scores.CAs.reduce((sum, ca) => sum + (ca.score || 0), 0);
            const totalCAMax = scores.CAs.reduce((sum, ca) => sum + (ca.max || 0), 0);
            const scaledCA = totalCAMax > 0 ? (totalCAScore / totalCAMax) * CA_WEIGHT : 0;

            const examScore = scores.Exam?.score || 0;
            const examMax = scores.Exam?.max || 0;
            const scaledExam = examMax > 0 ? (examScore / examMax) * EXAM_WEIGHT : 0;
            
            const finalScore = scaledCA + scaledExam;
            const gradeInfo = getGradeAndRemark(finalScore);
            
            const currentTermUpper = term.toUpperCase();
            const firstTermScore = currentTermUpper === 'FIRST' ? finalScore : (previousTermScores[name]?.FIRST || null);
            const secondTermScore = currentTermUpper === 'SECOND' ? finalScore : (previousTermScores[name]?.SECOND || null);
            const thirdTermScore = currentTermUpper === 'THIRD' ? finalScore : null;
            
            const validScores = [firstTermScore, secondTermScore, thirdTermScore].filter(s => s !== null && !isNaN(s)).map(parseFloat);
            const cumulativeAvg = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;

            return {
                subjectName: name, 
                ca_scaled: scaledCA.toFixed(1), 
                exam_scaled: scaledExam.toFixed(1), 
                finalScore: finalScore.toFixed(1),
                firstTerm: firstTermScore ? firstTermScore.toFixed(1) : null,
                secondTerm: secondTermScore ? secondTermScore.toFixed(1) : null,
                thirdTerm: thirdTermScore ? thirdTermScore.toFixed(1) : null,
                cumulativeAvg: cumulativeAvg ? cumulativeAvg.toFixed(1) : 'N/A', 
                grade: gradeInfo.grade, 
                remark: gradeInfo.remark
            };
        });
        
        res.json({ student: studentRes.rows[0], term: term.toUpperCase(), session, subjects: processedSubjects, meta: metaRes.rows[0] || {} });
    } catch (error) {
        console.error("Report compilation error:", error);
        res.status(500).json({ error: "Failed to compile report card data. " + error.message });
    } finally {
        client.release();
    }
});
/**
 * ROUTE: POST /api/exam-results/report/meta
 * Saves or updates the editable parts of the report card.
 */
router.post("/report/meta", auth, async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: "Access denied." });
    
    // **FIX**: Destructure all expected fields from the request body, including cumulativeData.
    const { 
        studentId, term, session, teacherComment, principalComment, 
        nextTermBegins, cumulativeData // cumulativeData is the JSON string
    } = req.body;

    // Basic validation
    if (!studentId || !term || !session) {
        return res.status(400).json({ error: "Missing required identifiers (studentId, term, session)." });
    }

    try {
        // **FIX**: The SQL query now includes `cumulative_data` in both the INSERT and UPDATE clauses.
        // Assumes your `report_card_meta` table has a column `cumulative_data` of type JSONB or TEXT.
        const query = `
            INSERT INTO report_card_meta (student_id, term, session, teacher_comment, principal_comment, next_term_begins, cumulative_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (student_id, term, session) 
            DO UPDATE SET
                teacher_comment = EXCLUDED.teacher_comment,
                principal_comment = EXCLUDED.principal_comment,
                next_term_begins = EXCLUDED.next_term_begins,
                cumulative_data = EXCLUDED.cumulative_data,
                updated_at = NOW();
        `;
        // Make sure nextTermBegins is null if it's an empty string or just 'TBA'
        const finalNextTerm = (nextTermBegins && nextTermBegins.trim() !== '' && nextTermBegins.toUpperCase() !== 'TBA') ? nextTermBegins : null;

        await pool.query(query, [studentId, term, session, teacherComment, principalComment, finalNextTerm, cumulativeData]);
        res.status(200).json({ message: "Report card data saved successfully." });
    } catch (error) {
        console.error("Error saving report meta:", error);
        res.status(500).json({ error: "Failed to save report card data." });
    }
});

/**
 * ROUTE: GET /api/exam-results/by-result/:resultId
 * Gets a student's detailed result view by the result ID.
 */
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
        if (examQuery.rows.length === 0) return res.status(404).json({ error: "Associated exam could not be found." });
        
        const questionsQuery = await pool.query(
          `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation
           FROM questions WHERE exam_id = $1 ORDER BY question_id ASC`,
          [result.exam_id]
        );
        
        res.json({
            exam: { ...examQuery.rows[0], ...result },
            questions: questionsQuery.rows,
            viewMode: 'student'
        });
    } catch (error) {
        console.error("Fetch by-result-id error:", error);
        res.status(500).json({ error: "Failed to fetch detailed result." });
    }
});

module.exports = router;
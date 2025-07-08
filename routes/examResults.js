// routes/examResults.js
const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const auth = require("../middlewares/auth");

// Middleware to ensure only admins or teachers can access these routes for CUD (Create, Update, Delete)
const isAdminOrTeacher = (req, res, next) => {
  if (!req.user || (!req.user.is_admin && req.user.role !== 'teacher')) {
    return res.status(403).json({ error: "Access denied. Admin or Teacher privileges required." });
  }
  next();
};

// --- Helper Functions ---
function getGradeAndRemark(score) {
    if (isNaN(score) || score === null) return { grade: 'N/A', remark: 'N/A' };
    const p = Math.round(score);
    if (p >= 90) return { grade: 'A*', remark: 'Distinction' };
    if (p >= 80) return { grade: 'A', remark: 'Excellent' };
    if (p >= 75) return { grade: 'B2', remark: 'Very Good' };
    if (p >= 70) return { grade: 'B3', remark: 'Good' };
    if (p >= 65) return { grade: 'C4', remark: 'Credit' };
    if (p >= 60) return { grade: 'C5', remark: 'Pass' };
    if (p >= 50) return { grade: 'C6', remark: 'Pass' };
    if (p >= 40) return { grade: 'D7', remark: 'Needs Improvement' };
    return { grade: 'F', remark: 'Fail' };
}

function getOrdinalSuffix(i) {
    if (isNaN(i) || i === null) return '';
    const j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return "st";
    }
    if (j == 2 && k != 12) {
        return "nd";
    }
    if (j == 3 && k != 13) {
        return "rd";
    }
    return "th";
}


// --- REBUILT & ENHANCED: The Report Card Engine ---
// This version correctly aggregates all non-exam assessments into a single CA score
// and calculates summary data on the backend.
router.get("/report-card/:studentId", auth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { studentId } = req.params;
        const { term, academicYear } = req.query;
        const requestingUser = req.user;

        // Authorization check: Only admin or teacher can access this report card
        if (!requestingUser.is_admin && requestingUser.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized." });
        }
        if (!term || !academicYear) {
            return res.status(400).json({ error: "Term and Academic Year are required." });
        }

        const studentQuery = await client.query(
            `SELECT u.id, u.username, u.admission_number, u.profile_picture_url, u.class_level_id, cl.level_name as class_level_name
             FROM users u
             LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id
             WHERE u.id = $1 AND u.role = 'student'`,
            [studentId]
        );
        if (studentQuery.rows.length === 0) {
            return res.status(404).json({ error: "Student not found." });
        }
        const student = studentQuery.rows[0];

        // --- Data Fetching for the entire class for ranking ---
        const studentClassLevelId = student.class_level_id;
        let classReportData = { // Initialize with default values
            student_id: student.id,
            total_final_score: 'N/A',
            overall_grade: 'N/A',
            overall_remark: 'N/A',
            subjects: [],
            position: 'N/A',
            class_size: 0
        };

        if (studentClassLevelId) {
            const classmatesResult = await client.query('SELECT id FROM users WHERE class_level_id = $1 AND role = \'student\'', [studentClassLevelId]);
            const classmateIds = classmatesResult.rows.map(u => u.id);

            const allClassResultsQuery = await client.query(
                `SELECT er.student_id, er.score, e.exam_type, s.name as subject_name, e.max_score
                 FROM exam_results er
                 JOIN exams e ON er.exam_id = e.exam_id
                 LEFT JOIN subjects s ON e.subject_id = s.subject_id
                 WHERE er.student_id = ANY($1::int[]) AND e.term = $2 AND e.session = $3`,
                [classmateIds, term, academicYear]
            );

            // --- Process data for ALL students in the class ---
            const allStudentsProcessedData = classmateIds.map(id => {
                const studentResults = allClassResultsQuery.rows.filter(r => r.student_id === id);
                const subjectsMap = new Map();

                studentResults.forEach(res => {
                    if (!res.subject_name) return;
                    if (!subjectsMap.has(res.subject_name)) {
                        subjectsMap.set(res.subject_name, { CAs: [], EXAM: null });
                    }
                    const subjectData = subjectsMap.get(res.subject_name);
                    const score = parseFloat(res.score);
                    // Ensure max_score is a number, default to 100 if null/undefined/invalid
                    const maxScore = parseFloat(res.max_score) || 100;
                    if (isNaN(score)) return;

                    const examType = (res.exam_type || '').toUpperCase();
                    if (examType === 'MAIN_EXAM') {
                        subjectData.EXAM = { score, maxScore };
                    } else { // Everything else is a CA (CA1, CA2, CA3, CA4, MID_TERM, OTHER)
                        subjectData.CAs.push({ score, maxScore });
                    }
                });

                let totalFinalScore = 0; // Sum of final scores for all subjects for this student
                let subjectsWithScoresCount = 0; // Count of subjects with at least one score
                const processedSubjects = [];

                subjectsMap.forEach((scores, subjectName) => {
                    // Calculate aggregated CA score (scaled to 40)
                    let totalCAScore = 0;
                    let totalCAMaxScore = 0;
                    scores.CAs.forEach(ca => {
                        totalCAScore += ca.score;
                        totalCAMaxScore += ca.maxScore;
                    });
                    const aggregatedCAScore = totalCAMaxScore > 0 ? (totalCAScore / totalCAMaxScore) * 40 : 0;

                    // Get exam score (scaled to 60)
                    const examScore = scores.EXAM ? (scores.EXAM.score / scores.EXAM.maxScore) * 60 : 0;

                    const finalScore = aggregatedCAScore + examScore;
                    const { grade, remark } = getGradeAndRemark(finalScore);

                    if (!isNaN(finalScore)) {
                        totalFinalScore += finalScore;
                        subjectsWithScoresCount++;
                    }

                    processedSubjects.push({
                        subject_name: subjectName,
                        ca_score: aggregatedCAScore.toFixed(2), // CA is now scaled to 40
                        exam_score: scores.EXAM ? scores.EXAM.score.toFixed(2) : 'N/A', // Keep raw exam score
                        total_score: finalScore.toFixed(2), // Total is CA (40) + Exam (60)
                        grade,
                        remark,
                        // Initialize cumulative data for display
                        cumulative_data: { 'FIRST': 'N/A', 'SECOND': 'N/A', 'THIRD': 'N/A' },
                        cumulative_avg: 'N/A'
                    });
                });

                const overallAverage = subjectsWithScoresCount > 0 ? (totalFinalScore / subjectsWithScoresCount).toFixed(2) : 'N/A';
                const { grade: overallGrade, remark: overallRemark } = getGradeAndRemark(parseFloat(overallAverage));

                return {
                    student_id: id,
                    total_final_score: parseFloat(overallAverage), // Use the overall average for ranking
                    overall_grade: overallGrade,
                    overall_remark: overallRemark,
                    subjects: processedSubjects // Include detailed subject scores
                };
            });

            // Sort all students by their total final score for ranking
            allStudentsProcessedData.sort((a, b) => {
                const scoreA = parseFloat(a.total_final_score);
                const scoreB = parseFloat(b.total_final_score);
                if (isNaN(scoreA) && isNaN(scoreB)) return 0;
                if (isNaN(scoreA)) return 1;
                if (isNaN(scoreB)) return -1;
                return scoreB - scoreA; // Descending order
            });

            // Assign ranks
            allStudentsProcessedData.forEach((data, i) => {
                data.position = i + 1;
            });

            // Find the current student's data and rank
            const foundStudentReportData = allStudentsProcessedData.find(d => d.student_id === studentId);
            if (foundStudentReportData) {
                classReportData = {
                    ...foundStudentReportData,
                    class_size: classmateIds.length
                };
            }
        }

        // Fetch report card metadata (teacher/principal comments, next term begins)
        const metaQuery = await client.query(
            `SELECT teacher_comment, principal_comment, next_term_begins FROM report_card_meta
             WHERE student_id = $1 AND term = $2 AND session = $3`,
            [studentId, term, academicYear]
        );
        const metaData = metaQuery.rows[0] || {};

        res.json({
            student_info: student,
            report_data: classReportData, // This now contains subjects and overall scores/rank
            meta_data: metaData
        });

    } catch (error) {
        console.error("Error generating report card:", error);
        res.status(500).json({ error: "Failed to generate report card: " + error.message });
    } finally {
        client.release();
    }
});


// GET /api/exam-results/:resultId - Get a single exam result with question details
router.get("/:resultId", auth, async (req, res) => {
    try {
        const { resultId } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.is_admin;
        const isTeacher = req.user.role === 'teacher';

        // Fetch the exam result
        const resultQuery = await pool.query(
            `SELECT er.*, e.title as exam_title, e.duration_minutes, e.pass_mark, e.exam_type, e.term, e.session,
                    s.name as subject_name, cl.level_name as class_level_name,
                    u.username as student_name, u.admission_number
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             LEFT JOIN subjects s ON e.subject_id = s.subject_id
             LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
             JOIN users u ON er.student_id = u.id
             WHERE er.result_id = $1`,
            [resultId]
        );

        if (resultQuery.rows.length === 0) {
            return res.status(404).json({ error: "Exam result not found." });
        }

        const examResult = resultQuery.rows[0];

        // Authorization check: student can only view their own results, admin/teacher can view any
        if (!isAdmin && !isTeacher && examResult.student_id !== userId) {
            return res.status(403).json({ error: "Unauthorized to view this result." });
        }

        // Parse answers from JSONB
        const studentAnswers = examResult.answers || {};

        // Fetch exam details with sections and questions
        const examDetailsQuery = await pool.query(
            `SELECT es.section_id, es.section_name, es.section_instructions,
                    q.question_id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation
             FROM exam_sections es
             JOIN questions q ON es.section_id = q.section_id
             WHERE es.exam_id = $1
             ORDER BY es.section_order ASC, q.question_id ASC`,
            [examResult.exam_id]
        );

        const sectionsMap = new Map();
        examDetailsQuery.rows.forEach(row => {
            if (!sectionsMap.has(row.section_id)) {
                sectionsMap.set(row.section_id, {
                    section_id: row.section_id,
                    section_name: row.section_name,
                    section_instructions: row.section_instructions,
                    questions: []
                });
            }
            const section = sectionsMap.get(row.section_id);
            section.questions.push({
                question_id: row.question_id,
                question_text: row.question_text,
                option_a: row.option_a,
                option_b: row.option_b,
                option_c: row.option_c,
                option_d: row.option_d,
                correct_answer: row.correct_answer,
                explanation: row.explanation,
                user_answer: studentAnswers[row.question_id] || null, // Add student's answer
                is_correct: studentAnswers[row.question_id] === row.correct_answer // Add correctness flag
            });
        });

        examResult.sections = Array.from(sectionsMap.values());

        res.json(examResult);
    } catch (error) {
        console.error("Error fetching exam result details:", error);
        res.status(500).json({ error: "Failed to fetch exam result details." });
    }
});

// GET /api/exam-results/exam/:examId/all - Get all results for a specific exam (for teacher/admin)
router.get("/exam/:examId/all", auth, async (req, res) => {
    try {
        const { examId } = req.params;
        const requestingUser = req.user;

        // Authorization: Only admin or teacher can view all results for an exam
        if (!requestingUser.is_admin && requestingUser.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized: Only administrators or teachers can view all exam results." });
        }

        const resultsQuery = await pool.query(
            `SELECT er.result_id, er.student_id, er.score, er.raw_score_obtained, er.total_possible_marks, er.submission_date,
                    u.username as student_name, u.admission_number,
                    e.title as exam_title, s.name as subject_name, cl.level_name as class_level_name, e.exam_type, e.term, e.session
             FROM exam_results er
             JOIN users u ON er.student_id = u.id
             JOIN exams e ON er.exam_id = e.exam_id
             LEFT JOIN subjects s ON e.subject_id = s.subject_id
             LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
             WHERE er.exam_id = $1
             ORDER BY u.username ASC`, // Order by student name
            [examId]
        );

        res.json(resultsQuery.rows);
    } catch (error) {
        console.error("Error fetching all exam results for exam:", error);
        res.status(500).json({ error: "Failed to fetch exam results summary." });
    }
});

// PUT /api/exam-results/report-card-meta - Update report card metadata (teacher/principal comments)
router.put("/report-card-meta", auth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { studentId, term, session, teacher_comment, principal_comment, next_term_begins } = req.body;
        
        if (!req.user.is_admin && req.user.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized." });
        }
        if (!studentId || !term || !session) {
            return res.status(400).json({ error: "Missing required parameters." });
        }
        
        await client.query('BEGIN');

        const query = `
            INSERT INTO report_card_meta (student_id, term, session, teacher_comment, principal_comment, next_term_begins)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (student_id, term, session) DO UPDATE SET
                teacher_comment = EXCLUDED.teacher_comment,
                principal_comment = EXCLUDED.principal_comment,
                next_term_begins = EXCLUDED.next_term_begins,
                updated_at = NOW()
            RETURNING *;
        `;

        const result = await client.query(query, [studentId, term, session, teacher_comment, principal_comment, next_term_begins]);
        await client.query('COMMIT');
        res.json({ message: "Report card metadata updated successfully.", data: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error updating report card metadata:", error);
        res.status(500).json({ error: "Failed to update report card metadata: " + error.message });
    } finally {
        client.release();
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
router.delete('/:studentId/:term/:session', auth, isAdminOrTeacher, async (req, res) => {
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
    console.error("Error deleting report card metadata:", error);
    res.status(500).json({ error: "Failed to delete report card meta data." });
  }
});

module.exports = router;

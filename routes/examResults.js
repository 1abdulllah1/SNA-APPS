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

// Helper to define term order for cumulative calculations
const termOrder = {
    'FIRST': 1,
    'SECOND': 2,
    'THIRD': 3
};


// --- REBUILT & ENHANCED: The Report Card Engine ---
// This version correctly aggregates all non-exam assessments into a single CA score
// and calculates summary data on the backend.
router.get("/report-card/:studentId", auth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { studentId } = req.params;
        const { term, academicYear } = req.query;
        const requestingUser = req.user;

        // Authorization check
        if (!requestingUser.is_admin && requestingUser.role !== 'teacher' && requestingUser.id !== parseInt(studentId)) {
            return res.status(403).json({ error: "Unauthorized: You do not have permission to view this report card." });
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
        const studentClassLevelId = student.class_level_id;

        // Fetch all subjects for the student's class level
        const allSubjectsQuery = await client.query(`SELECT subject_id, name FROM subjects WHERE class_level_id = $1 ORDER BY name ASC`, [studentClassLevelId]);
        const allSubjects = allSubjectsQuery.rows;

        // Fetch all classmates
        const classmatesResult = await client.query('SELECT id FROM users WHERE class_level_id = $1 AND role = \'student\'', [studentClassLevelId]);
        const classmateIds = classmatesResult.rows.map(u => u.id);

        // Fetch all results for all classmates for the entire academic year
        const allClassResultsQuery = await client.query(
            `SELECT er.student_id, er.score, e.exam_type, s.name as subject_name, e.max_score, e.term
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             LEFT JOIN subjects s ON e.subject_id = s.subject_id
             WHERE er.student_id = ANY($1::int[]) AND e.session = $2`,
            [classmateIds, academicYear]
        );

        // --- Process data for ALL students to determine ranks and averages ---
        const allStudentsProcessedData = classmateIds.map(id => {
            const studentResults = allClassResultsQuery.rows.filter(r => r.student_id === id);
            const subjectsMap = new Map();

            studentResults.forEach(res => {
                if (!res.subject_name) return;
                if (!subjectsMap.has(res.subject_name)) subjectsMap.set(res.subject_name, { terms: {} });
                
                const subjectData = subjectsMap.get(res.subject_name);
                const resultTerm = res.term.toUpperCase();
                if (!subjectData.terms[resultTerm]) subjectData.terms[resultTerm] = { CAs: [], EXAM: null };

                const examType = (res.exam_type || '').toUpperCase();
                const scoreData = { score: parseFloat(res.score), maxScore: parseFloat(res.max_score) || 100 };
                if (isNaN(scoreData.score)) return;

                if (examType === 'MAIN_EXAM') {
                    subjectData.terms[resultTerm].EXAM = scoreData;
                } else {
                    subjectData.terms[resultTerm].CAs.push(scoreData);
                }
            });

            let grandTotalForTerm = 0;
            let subjectsWithScoresCount = 0;
            const processedSubjects = [];

            allSubjects.forEach(subject => {
                const subjectName = subject.name;
                const subjectScoresByTerm = subjectsMap.get(subjectName)?.terms || {};
                const cumulativeData = {};
                let currentTermFinalScore = null;
                let cumulativeSum = 0;
                let cumulativeCount = 0;

                for (const t of ['FIRST', 'SECOND', 'THIRD']) {
                    const termData = subjectScoresByTerm[t] || { CAs: [], EXAM: null };

                    // Calculate aggregated CA score (out of 40)
                    let aggregatedCAScore = 0;
                    const totalCAScore = termData.CAs.reduce((sum, ca) => sum + ca.score, 0);
                    const totalCAMaxScore = termData.CAs.reduce((sum, ca) => sum + ca.maxScore, 0);
                    if (totalCAMaxScore > 0) { // Only calculate if total max score for CAs is positive
                        aggregatedCAScore = (totalCAScore / totalCAMaxScore) * 40;
                        aggregatedCAScore = Math.min(40, Math.max(0, aggregatedCAScore)); // Cap between 0 and 40
                    }

                    // Calculate exam score (out of 60)
                    let examScore = 0;
                    if (termData.EXAM && termData.EXAM.maxScore > 0) { // Only calculate if exam data exists and max score is positive
                        examScore = (termData.EXAM.score / termData.EXAM.maxScore) * 60;
                        examScore = Math.min(60, Math.max(0, examScore)); // Cap between 0 and 60
                    }

                    // Calculate final score for the term (out of 100)
                    let finalScoreForTerm = null;
                    // Only calculate if there was any valid CA or Exam data (i.e., at least one component had a positive max score)
                    if (totalCAMaxScore > 0 || (termData.EXAM && termData.EXAM.maxScore > 0)) {
                        finalScoreForTerm = aggregatedCAScore + examScore;
                        finalScoreForTerm = Math.min(100, Math.max(0, finalScoreForTerm)); // Cap between 0 and 100
                    }

                    cumulativeData[t] = finalScoreForTerm;

                    if (termOrder[t] <= termOrder[term.toUpperCase()] && finalScoreForTerm !== null) {
                        cumulativeSum += finalScoreForTerm;
                        cumulativeCount++;
                    }
                    if (t === term.toUpperCase()) {
                        currentTermFinalScore = finalScoreForTerm;
                    }
                }

                if (currentTermFinalScore !== null) {
                    grandTotalForTerm += currentTermFinalScore;
                    subjectsWithScoresCount++;
                }

                const currentTermData = subjectScoresByTerm[term.toUpperCase()] || { CAs: [], EXAM: null };
                const sumCAs = currentTermData.CAs.reduce((sum, ca) => sum + ca.score, 0);
                const sumCAMax = currentTermData.CAs.reduce((sum, ca) => sum + ca.maxScore, 0);

                // Recalculate CA and Exam scores for the current term for display purposes
                let ca_score_display = null;
                if (sumCAMax > 0) {
                    ca_score_display = (sumCAs / sumCAMax) * 40;
                    ca_score_display = Math.min(40, Math.max(0, ca_score_display));
                }

                let exam_score_display = null;
                if (currentTermData.EXAM && currentTermData.EXAM.maxScore > 0) {
                    exam_score_display = (currentTermData.EXAM.score / currentTermData.EXAM.maxScore) * 60;
                    exam_score_display = Math.min(60, Math.max(0, exam_score_display));
                }


                processedSubjects.push({
                    subject_name: subjectName,
                    ca_score: ca_score_display,
                    exam_score: exam_score_display,
                    total_score: currentTermFinalScore, // This will now be capped at 100
                    grade: getGradeAndRemark(currentTermFinalScore).grade,
                    remark: getGradeAndRemark(currentTermFinalScore).remark,
                    cumulative_data: cumulativeData,
                    cumulative_avg: cumulativeCount > 0 ? (cumulativeSum / cumulativeCount) : null
                });
            });

            const overallAverageForTerm = subjectsWithScoresCount > 0 ? (grandTotalForTerm / subjectsWithScoresCount) : null;

            return {
                student_id: id,
                grand_total_score: grandTotalForTerm, // Sum of all subject final scores (each capped at 100)
                overall_percentage: overallAverageForTerm, // Average percentage across subjects
                subjects: processedSubjects
            };
        });

        // Sort students by their grand total score for ranking
        allStudentsProcessedData.sort((a, b) => b.grand_total_score - a.grand_total_score);

        // Assign ranks
        allStudentsProcessedData.forEach((data, i) => {
            data.position = i + 1;
        });

        // Find the current student's complete report data
        const finalReportData = allStudentsProcessedData.find(d => d.student_id === parseInt(studentId)) || {};
        finalReportData.class_size = classmateIds.length;

        // Fetch report card metadata
        const metaQuery = await client.query(
            `SELECT teacher_comment, principal_comment, next_term_begins, teacher_signature_url, principal_signature_url FROM report_card_meta
             WHERE student_id = $1 AND term = $2 AND session = $3`,
            [studentId, term, academicYear]
        );
        const metaData = metaQuery.rows[0] || {};

        res.json({
            student_info: student,
            report_data: finalReportData,
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
        const requestingUser = req.user;
        
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

        // Students are now blocked from viewing their own results.
        if (requestingUser.role === 'student') {
            return res.status(403).json({ error: "Access Denied. Students are not permitted to view detailed results." });
        }

        // Authorization check for teacher/admin
        if (!requestingUser.is_admin && requestingUser.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized to view this result." });
        }

        const studentAnswers = examResult.answers || {};
        const examDetailsQuery = await pool.query(
            `SELECT es.section_id, es.section_name, q.question_id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation
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
                    questions: []
                });
            }
            sectionsMap.get(row.section_id).questions.push({
                question_id: row.question_id,
                question_text: row.question_text,
                options: { A: row.option_a, B: row.option_b, C: row.option_c, D: row.option_d },
                correct_answer: row.correct_answer,
                explanation: row.explanation,
                user_answer: studentAnswers[row.question_id] || null,
                is_correct: studentAnswers[row.question_id] === row.correct_answer
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
router.get("/exam/:examId/all", auth, isAdminOrTeacher, async (req, res) => {
    try {
        const { examId } = req.params;
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
             ORDER BY u.username ASC`,
            [examId]
        );
        res.json(resultsQuery.rows);
    } catch (error) {
        console.error("Error fetching all exam results for exam:", error);
        res.status(500).json({ error: "Failed to fetch exam results summary." });
    }
});

// GET /api/exam-results/student/:studentId/recent - Get recent attempts for a student
router.get("/student/:studentId/recent", auth, async (req, res) => {
    try {
        const { studentId } = req.params;
        if (req.user.id !== parseInt(studentId) && !req.user.is_admin) {
            return res.status(403).json({ error: "Unauthorized to view these results." });
        }

        const recentResultsQuery = await pool.query(
            `SELECT 
                er.result_id,
                er.submission_date AS "submissionDate",
                e.title AS "examTitle",
                e.exam_type AS "examType"
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             WHERE er.student_id = $1
             ORDER BY er.submission_date DESC
             LIMIT 5`,
            [studentId]
        );
        res.json(recentResultsQuery.rows);
    } catch (error) {
        console.error("Error fetching recent student exam results:", error);
        res.status(500).json({ error: "Failed to fetch recent exam results." });
    }
});


// PUT /api/exam-results/report-card-meta - Update report card metadata
router.put("/report-card-meta", auth, isAdminOrTeacher, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { studentId, term, session, teacher_comment, principal_comment, next_term_begins, teacher_signature_url, principal_signature_url } = req.body;
        
        if (!studentId || !term || !session) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Missing required parameters." });
        }
        
        const query = `
            INSERT INTO report_card_meta (student_id, term, session, teacher_comment, principal_comment, next_term_begins, teacher_signature_url, principal_signature_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (student_id, term, session) DO UPDATE SET
                teacher_comment = EXCLUDED.teacher_comment,
                principal_comment = EXCLUDED.principal_comment,
                next_term_begins = EXCLUDED.next_term_begins,
                teacher_signature_url = EXCLUDED.teacher_signature_url,
                principal_signature_url = EXCLUDED.principal_signature_url,
                updated_at = NOW()
            RETURNING *;
        `;

        const result = await client.query(query, [studentId, term, session, teacher_comment, principal_comment, next_term_begins, teacher_signature_url, principal_signature_url]);
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

// DELETE /api/report-card-meta/:studentId/:term/:session - Delete metadata
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

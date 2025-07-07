// routes/examResults.js
const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const auth = require("../middlewares/auth");

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
        let classReportData = [];
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
                    const maxScore = parseFloat(res.max_score) || 100; // Default to 100 if not set

                    if (isNaN(score)) return;

                    const examType = (res.exam_type || '').toUpperCase();
                    if (examType === 'MAIN_EXAM') {
                        subjectData.EXAM = { score, maxScore };
                    } else { // Everything else is a CA
                        subjectData.CAs.push({ score, maxScore });
                    }
                });

                let totalFinalScore = 0;
                let subjectsWithScoresCount = 0;
                
                subjectsMap.forEach((scores, subjectName) => {
                    // Calculate aggregated CA score (scaled to 40)
                    let totalCAScore = 0;
                    let totalCAMaxScore = 0;
                    scores.CAs.forEach(ca => {
                        totalCAScore += ca.score;
                        totalCAMaxScore += ca.maxScore;
                    });
                    const scaled_ca = totalCAMaxScore > 0 ? (totalCAScore / totalCAMaxScore) * 40 : 0;
                    
                    // Calculate exam score (scaled to 60)
                    const scaled_exam = scores.EXAM && scores.EXAM.maxScore > 0 ? (scores.EXAM.score / scores.EXAM.maxScore) * 60 : 0;
                    
                    if (scores.CAs.length > 0 || scores.EXAM) {
                        totalFinalScore += (scaled_ca + scaled_exam);
                        subjectsWithScoresCount++;
                    }
                });

                const overallPercentage = subjectsWithScoresCount > 0 ? (totalFinalScore / subjectsWithScoresCount) : 0;
                return { studentId: id, overallPercentage, totalFinalScore };
            });
            classReportData = allStudentsProcessedData;
        }

        // --- Sort and Rank students ---
        const sortedStudents = classReportData.sort((a, b) => b.totalFinalScore - a.totalFinalScore);
        const rank = sortedStudents.findIndex(entry => entry.studentId === parseInt(studentId)) + 1;
        
        // --- Prepare final payload for the specific student ---
        const studentData = classReportData.find(s => s.studentId === parseInt(studentId)) || {};
        const summary = {
            totalScoreObtained: studentData.totalFinalScore ? studentData.totalFinalScore.toFixed(1) : 'N/A',
            overallPercentage: studentData.overallPercentage ? studentData.overallPercentage.toFixed(1) : 'N/A',
            position: rank > 0 ? `${rank}${getOrdinalSuffix(rank)} out of ${sortedStudents.length}` : 'N/A',
        };

        const studentSpecificResults = await client.query(
            `SELECT er.result_id, er.score, e.exam_type, s.name as subject_name, e.max_score
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             LEFT JOIN subjects s ON e.subject_id = s.subject_id
             WHERE er.student_id = $1 AND e.term = $2 AND e.session = $3`,
            [studentId, term, academicYear]
        );

        const subjectsMap = new Map();
        studentSpecificResults.rows.forEach(res => {
            if (!res.subject_name) return;
            if (!subjectsMap.has(res.subject_name)) {
                subjectsMap.set(res.subject_name, { CAs: [], EXAM: null, finalScore: 'N/A', grade: 'N/A', remark: 'N/A' });
            }
            const subjectData = subjectsMap.get(res.subject_name);
            const score = parseFloat(res.score);
            const maxScore = parseFloat(res.max_score) || 100;
            if (isNaN(score)) return;

            const examType = (res.exam_type || '').toUpperCase();
            if (examType === 'MAIN_EXAM') {
                subjectData.EXAM = { score, maxScore };
            } else {
                subjectData.CAs.push({ score, maxScore });
            }
        });

        subjectsMap.forEach(subjectData => {
            let totalCAScore = 0;
            let totalCAMaxScore = 0;
            subjectData.CAs.forEach(ca => {
                totalCAScore += ca.score;
                totalCAMaxScore += ca.maxScore;
            });
            subjectData.ca_scaled = totalCAMaxScore > 0 ? ((totalCAScore / totalCAMaxScore) * 40).toFixed(1) : 'N/A';
            
            subjectData.exam_scaled = subjectData.EXAM && subjectData.EXAM.maxScore > 0 ? ((subjectData.EXAM.score / subjectData.EXAM.maxScore) * 60).toFixed(1) : 'N/A';
            
            const caScoreNum = parseFloat(subjectData.ca_scaled) || 0;
            const examScoreNum = parseFloat(subjectData.exam_scaled) || 0;

            if (subjectData.ca_scaled !== 'N/A' || subjectData.exam_scaled !== 'N/A') {
                const finalScore = caScoreNum + examScoreNum;
                subjectData.finalScore = finalScore.toFixed(1);
                const { grade, remark } = getGradeAndRemark(finalScore);
                subjectData.grade = grade;
                subjectData.remark = remark;
            }
        });

        const reportCardData = {
            term: term,
            session: academicYear,
            subjects: Array.from(subjectsMap.entries()).map(([name, data]) => ({ subjectName: name, ...data }))
        };

        const metaQuery = await client.query(
            `SELECT teacher_comment, principal_comment, next_term_begins
             FROM report_card_meta
             WHERE student_id = $1 AND term = $2 AND session = $3`,
            [studentId, term, academicYear]
        );
        const metadata = metaQuery.rows[0] || {};
        
        res.json({ student, reportCardData, metadata, summary });

    } catch (error) {
        console.error("Error fetching report card:", error);
        res.status(500).json({ error: "Failed to fetch report card: " + error.message });
    } finally {
        client.release();
    }
});


// GET /api/exam-results/student/:studentId/recent
router.get("/student/:studentId/recent", auth, async (req, res) => {
    try {
        const { studentId } = req.params;
        const requestingUser = req.user;

        if (requestingUser.id !== parseInt(studentId) && !requestingUser.is_admin && requestingUser.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized." });
        }

        const recentResultsQuery = await pool.query(
            `SELECT er.result_id, er.score, er.submission_date, e.title as exam_title, e.exam_type
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             WHERE er.student_id = $1
             ORDER BY er.submission_date DESC
             LIMIT 5`,
            [studentId]
        );
        
        const recentResults = recentResultsQuery.rows.map(result => ({
            resultId: result.result_id,
            score: parseFloat(result.score) || null,
            submissionDate: result.submission_date,
            examTitle: result.exam_title,
            examType: result.exam_type,
        }));

        res.json(recentResults);
    } catch (error) {
        console.error("Error fetching recent exam results:", error);
        res.status(500).json({ error: "Failed to fetch recent exam results." });
    }
});


// GET /api/exam-results/:resultId (for detailed view)
router.get("/:resultId", auth, async (req, res) => {
    try {
        const { resultId } = req.params;
        const requestingUser = req.user;

        const resultQuery = await pool.query(
            `SELECT er.*, e.title, e.duration_minutes, e.exam_type, e.pass_mark
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             WHERE er.result_id = $1`,
            [resultId]
        );

        if (resultQuery.rows.length === 0) {
            return res.status(404).json({ error: "Exam result not found." });
        }
        const result = resultQuery.rows[0];

        if (requestingUser.id !== result.student_id && !requestingUser.is_admin && requestingUser.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized." });
        }

        let questions = [];
        const examType = (result.exam_type || '').toUpperCase();
        if (requestingUser.is_admin || requestingUser.role === 'teacher' || examType !== 'MAIN_EXAM') {
            const questionsQuery = await pool.query(
                `SELECT q.question_id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation, q.marks
                 FROM questions q JOIN exam_sections es ON q.section_id = es.section_id WHERE es.exam_id = $1 ORDER BY q.question_id ASC`,
                [result.exam_id]
            );
            questions = questionsQuery.rows;
        }

        res.json({
            exam: {
                title: result.title,
                duration_minutes: result.duration_minutes,
                exam_type: result.exam_type,
                pass_mark: result.pass_mark,
            },
            score: parseFloat(result.score) || null,
            submission_time: result.submission_date,
            answers_submitted: result.answers,
            time_taken_seconds: result.time_taken_seconds,
            questions: questions,
        });

    } catch (error) {
        console.error("Fetch exam result by ID error:", error);
        res.status(500).json({ error: "Failed to fetch exam result." });
    }
});


// GET /api/exam-results/exam/:examId/all (for teacher/admin view)
router.get("/exam/:examId/all", auth, async (req, res) => {
    try {
        const { examId } = req.params;
        if (!req.user.is_admin && req.user.role !== 'teacher') return res.status(403).json({ error: "Unauthorized." });

        const examQuery = await pool.query(`SELECT title, exam_type FROM exams WHERE exam_id = $1`,[examId]);
        if (examQuery.rows.length === 0) return res.status(404).json({ error: "Exam not found." });

        const resultsQuery = await pool.query(
            `SELECT er.result_id, er.score, u.username, u.admission_number
             FROM exam_results er
             JOIN users u ON er.student_id = u.id
             WHERE er.exam_id = $1 ORDER BY u.username ASC`,
            [examId]
        );

        res.json({
            exam_title: examQuery.rows[0].title,
            exam_type: examQuery.rows[0].exam_type,
            results: resultsQuery.rows.map(r => ({...r, score: parseFloat(r.score) || null}))
        });

    } catch (error) {
        console.error("Error fetching all results for exam:", error);
        res.status(500).json({ error: "Failed to fetch all results." });
    }
});


// PUT /api/exam-results/report-card-meta
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
        res.status(500).json({ error: "Failed to update report card metadata." });
    } finally {
        client.release();
    }
});

module.exports = router;

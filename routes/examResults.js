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
    if (isNaN(i)) return '';
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
// Now calculates summary data including class position on the backend.
router.get("/report-card/:studentId", auth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { studentId } = req.params;
        const { term, academicYear } = req.query; // Get term and year from query params
        const requestingUser = req.user;

        if (!requestingUser.is_admin && requestingUser.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized: Only administrators and teachers can view report cards." });
        }
        if (!term || !academicYear) {
            return res.status(400).json({ error: "Term and Academic Year are required query parameters." });
        }

        const studentQuery = await client.query(
            `SELECT u.id, u.username, u.email, u.admission_number, u.profile_picture_url, u.class_level_id, cl.level_name as class_level_name
             FROM users u
             LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id
             WHERE u.id = $1 AND u.role = 'student'`,
            [studentId]
        );
        if (studentQuery.rows.length === 0) {
            return res.status(404).json({ error: "Student not found." });
        }
        const student = studentQuery.rows[0];

        const resultsQuery = await client.query(
            `SELECT er.result_id, er.exam_id, er.score, e.title as exam_title, e.exam_type, s.name as subject_name, e.term, e.session
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             LEFT JOIN subjects s ON e.subject_id = s.subject_id
             WHERE er.student_id = $1
             ORDER BY e.session DESC, e.term DESC`,
            [studentId]
        );
        const allExamResultsForStudent = resultsQuery.rows.map(r => ({ ...r, score: parseFloat(r.score) }));

        const groupedResults = allExamResultsForStudent.reduce((acc, result) => {
            const sessionTermKey = `${result.session || 'N/A'}-${result.term || 'N/A'}`;
            if (!acc[sessionTermKey]) {
                acc[sessionTermKey] = { session: result.session, term: result.term, exams: [] };
            }
            acc[sessionTermKey].exams.push({
                resultId: result.result_id,
                examId: result.exam_id,
                examTitle: result.exam_title,
                examType: result.exam_type,
                subjectName: result.subject_name,
                score: result.score,
            });
            return acc;
        }, {});
        const reportCardData = Object.values(groupedResults);

        // --- Summary Calculation Logic ---
        let summary = { totalScoreObtained: 'N/A', overallPercentage: 'N/A', position: 'N/A' };
        const studentClassLevelId = student.class_level_id;

        if (studentClassLevelId) {
            const classmatesResult = await client.query('SELECT id FROM users WHERE class_level_id = $1 AND role = \'student\'', [studentClassLevelId]);
            const classmateIds = classmatesResult.rows.map(u => u.id);

            const allClassResultsQuery = await client.query(
                `SELECT er.student_id, er.score, e.exam_type, s.name as subject_name
                 FROM exam_results er
                 JOIN exams e ON er.exam_id = e.exam_id
                 LEFT JOIN subjects s ON e.subject_id = s.subject_id
                 WHERE er.student_id = ANY($1::int[]) AND e.term = $2 AND e.session = $3`,
                [classmateIds, term, academicYear]
            );

            const studentPercentages = {};
            classmateIds.forEach(id => {
                const studentResults = allClassResultsQuery.rows.filter(r => r.student_id === id);
                const studentSubjectsMap = new Map();
                studentResults.forEach(res => {
                    if (!res.subject_name) return;
                    if (!studentSubjectsMap.has(res.subject_name)) {
                        studentSubjectsMap.set(res.subject_name, { ca: null, exam: null });
                    }
                    const subject = studentSubjectsMap.get(res.subject_name);
                    const score = parseFloat(res.score);
                    if (isNaN(score)) return;
                    if (res.exam_type.startsWith('CA')) subject.ca = score;
                    if (res.exam_type === 'MAIN_EXAM') subject.exam = score;
                });

                let totalFinalScore = 0;
                let subjectsCount = 0;
                studentSubjectsMap.forEach(scores => {
                    const ca = scores.ca !== null ? scores.ca : 0;
                    const exam = scores.exam !== null ? scores.exam : 0;
                    if (scores.ca !== null || scores.exam !== null) {
                        totalFinalScore += (ca * 0.4) + (exam * 0.6);
                        subjectsCount++;
                    }
                });
                studentPercentages[id] = subjectsCount > 0 ? (totalFinalScore / subjectsCount) : 0;
            });
            
            const sortedStudents = Object.entries(studentPercentages).sort((a, b) => b[1] - a[1]);
            const rank = sortedStudents.findIndex(entry => parseInt(entry[0]) === parseInt(studentId)) + 1;

            if (rank > 0) {
                summary.position = `${rank}${getOrdinalSuffix(rank)} out of ${sortedStudents.length}`;
            }
            const studentOverallPercentage = studentPercentages[studentId];
            if (studentOverallPercentage !== undefined) {
                summary.overallPercentage = studentOverallPercentage.toFixed(1);
                // Grand total is the sum of final scores for each subject for that student
                const studentTermResults = allClassResultsQuery.rows.filter(r => r.student_id === parseInt(studentId));
                 const studentTermSubjectsMap = new Map();
                studentTermResults.forEach(res => {
                     if (!res.subject_name) return;
                    if (!studentTermSubjectsMap.has(res.subject_name)) {
                        studentTermSubjectsMap.set(res.subject_name, { ca: null, exam: null });
                    }
                    const subject = studentTermSubjectsMap.get(res.subject_name);
                    const score = parseFloat(res.score);
                    if (isNaN(score)) return;
                    if (res.exam_type.startsWith('CA')) subject.ca = score;
                    if (res.exam_type === 'MAIN_EXAM') subject.exam = score;
                });
                let grandTotal = 0;
                 studentTermSubjectsMap.forEach(scores => {
                    const ca = scores.ca !== null ? scores.ca : 0;
                    const exam = scores.exam !== null ? scores.exam : 0;
                    if (scores.ca !== null || scores.exam !== null) {
                        grandTotal += (ca * 0.4) + (exam * 0.6);
                    }
                });
                summary.totalScoreObtained = grandTotal.toFixed(1);
            }
        }
        
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
// Fetches a student's most recent exam results for the dashboard.
router.get("/student/:studentId/recent", auth, async (req, res) => {
    try {
        const { studentId } = req.params;
        const requestingUser = req.user;

        if (requestingUser.id !== parseInt(studentId) && !requestingUser.is_admin && requestingUser.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized: You can only view your own recent exam results." });
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
        res.status(500).json({ error: "Failed to fetch recent exam results: " + error.message });
    }
});


// GET /api/exam-results/:resultId (for detailed view of a single result)
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

        let viewMode = 'student';
        if (requestingUser.is_admin || requestingUser.role === 'teacher') {
            viewMode = 'admin_teacher';
        } else if (requestingUser.id !== result.student_id) {
            return res.status(403).json({ error: "Unauthorized: You can only view your own exam results." });
        }

        let questions = [];
        if (viewMode === 'admin_teacher' || result.exam_type !== 'MAIN_EXAM') {
            const questionsQuery = await pool.query(
                `SELECT q.question_id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation, q.marks
                 FROM questions q
                 JOIN exam_sections es ON q.section_id = es.section_id
                 WHERE es.exam_id = $1
                 ORDER BY q.question_id ASC`,
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
        res.status(500).json({ error: "Failed to fetch exam result: " + error.message });
    }
});

// GET /api/exam-results/exam/:examId/all (for teacher/admin to see all results for an exam)
router.get("/exam/:examId/all", auth, async (req, res) => {
    try {
        const { examId } = req.params;
        const requestingUser = req.user;

        if (!requestingUser.is_admin && requestingUser.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized." });
        }

        const examQuery = await pool.query(
            `SELECT title, exam_type, term, session FROM exams WHERE exam_id = $1`,
            [examId]
        );
        if (examQuery.rows.length === 0) {
            return res.status(404).json({ error: "Exam not found." });
        }
        const examDetails = examQuery.rows[0];

        const resultsQuery = await pool.query(
            `SELECT er.result_id, er.score, er.submission_date,
                    u.username, u.admission_number, cl.level_name as class_name
             FROM exam_results er
             JOIN users u ON er.student_id = u.id
             LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id
             WHERE er.exam_id = $1
             ORDER BY u.username ASC`,
            [examId]
        );

        res.json({
            exam_title: examDetails.title,
            exam_type: examDetails.exam_type,
            term: examDetails.term,
            session: examDetails.session,
            results: resultsQuery.rows.map(r => ({...r, score: parseFloat(r.score) || null}))
        });

    } catch (error) {
        console.error("Error fetching all results for exam:", error);
        res.status(500).json({ error: "Failed to fetch all results for exam: " + error.message });
    }
});

// PUT /api/exam-results/report-card-meta
router.put("/report-card-meta", auth, async (req, res) => {
    try {
        const { studentId, term, session, teacher_comment, principal_comment, next_term_begins } = req.body;
        const requestingUser = req.user;

        if (!requestingUser.is_admin && requestingUser.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized." });
        }

        if (!studentId || !term || !session) {
            return res.status(400).json({ error: "Missing required parameters for metadata update." });
        }

        const client = await pool.connect();
        try {
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
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error in PUT /report-card-meta route:", error);
        res.status(500).json({ error: "Failed to update report card metadata." });
    }
});

module.exports = router;

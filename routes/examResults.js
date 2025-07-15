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

        // Fetch all exam results for the student for the given academic year and up to the specified term
        const allClassResultsQuery = await client.query(
            `SELECT
                er.student_id,
                er.exam_id,
                er.score,
                er.raw_score_obtained,
                er.total_possible_marks,
                er.submission_date,
                e.title AS exam_title,
                e.exam_type,
                e.term,
                e.session,
                e.pass_mark,
                s.name AS subject_name,
                s.subject_id,
                u.username AS student_name,
                u.admission_number,
                cl.level_name AS class_level_name,
                er.answers AS student_answers,
                e.sections AS exam_sections_structure -- Get the original exam structure to match questions
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.exam_id
            JOIN subjects s ON e.subject_id = s.subject_id
            JOIN users u ON er.student_id = u.id
            LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id
            WHERE er.student_id = $1
              AND e.session = $2
              AND term_order[e.term] <= term_order[$3::text]
            ORDER BY e.term, s.name`,
            [studentId, academicYear, term]
        );

        const studentResults = allClassResultsQuery.rows;

        // Aggregate scores by subject for the current term
        const subjectScores = {};
        allSubjects.forEach(subject => {
            subjectScores[subject.subject_id] = {
                name: subject.name,
                ca_scores: [], // To hold scores from CA1, CA2, etc.
                main_exam_score: null,
                total_ca_marks: 0, // Sum of total_possible_marks for CAs
                total_main_exam_marks: 0 // Total possible marks for main exam
            };
        });

        studentResults.forEach(result => {
            if (result.term === term) { // Only process results for the current term for detailed breakdown
                const subject = subjectScores[result.subject_id];
                if (subject) {
                    if (result.exam_type.startsWith('CA')) {
                        subject.ca_scores.push({
                            score: result.raw_score_obtained,
                            max_score: result.total_possible_marks
                        });
                        subject.total_ca_marks += result.total_possible_marks;
                    } else if (result.exam_type === 'MAIN_EXAM') {
                        subject.main_exam_score = result.raw_score_obtained;
                        subject.total_main_exam_marks = result.total_possible_marks;
                    }
                }
            }
        });

        const detailedSubjectResults = [];
        let grandTotalScore = 0;
        let grandTotalMaxMarks = 0;

        for (const subjectId in subjectScores) {
            const subject = subjectScores[subjectId];
            let totalCAScore = 0;
            let totalCAMaxMarks = 0;

            subject.ca_scores.forEach(ca => {
                totalCAScore += ca.score;
                totalCAMaxMarks += ca.max_score;
            });

            // Calculate overall subject score
            let overallSubjectScore = 0;
            let overallSubjectMaxMarks = 0;

            // Assuming CA is 40% and Main Exam is 60% if both exist
            // If only CA exists, it's 100% of CA. If only Main Exam, it's 100% of Main Exam.
            if (totalCAMaxMarks > 0 && subject.total_main_exam_marks > 0) {
                // Both CA and Main Exam exist, apply 40/60 weighting
                const caPercentage = (totalCAScore / totalCAMaxMarks) * 40;
                const mainExamPercentage = (subject.main_exam_score / subject.total_main_exam_marks) * 60;
                overallSubjectScore = caPercentage + mainExamPercentage;
                overallSubjectMaxMarks = 100; // Represented as a percentage out of 100
            } else if (totalCAMaxMarks > 0) {
                // Only CA exists, score is based solely on CA
                overallSubjectScore = (totalCAScore / totalCAMaxMarks) * 100;
                overallSubjectMaxMarks = 100;
            } else if (subject.total_main_exam_marks > 0 && subject.main_exam_score !== null) {
                // Only Main Exam exists, score is based solely on Main Exam
                overallSubjectScore = (subject.main_exam_score / subject.total_main_exam_marks) * 100;
                overallSubjectMaxMarks = 100;
            } else {
                overallSubjectScore = 0;
                overallSubjectMaxMarks = 100; // No score, but still out of 100 for consistency
            }

            const { grade, remark } = getGradeAndRemark(overallSubjectScore);

            detailedSubjectResults.push({
                subject_name: subject.name,
                ca_score: totalCAScore, // Raw sum of CA scores
                ca_max_marks: totalCAMaxMarks, // Raw sum of CA max marks
                main_exam_score: subject.main_exam_score,
                main_exam_max_marks: subject.total_main_exam_marks,
                overall_score: parseFloat(overallSubjectScore.toFixed(2)), // Percentage
                grade: grade,
                remark: remark
            });

            // For grand total, sum up the actual percentage scores
            grandTotalScore += overallSubjectScore;
            grandTotalMaxMarks += 100; // Each subject contributes 100% to the overall average
        }

        const numberOfSubjects = detailedSubjectResults.length;
        const overallAverage = numberOfSubjects > 0 ? (grandTotalScore / numberOfSubjects) : 0;
        const { grade: overallGrade, remark: overallRemark } = getGradeAndRemark(overallAverage);

        // Fetch report card metadata
        const reportMetaQuery = await client.query(
            `SELECT teacher_comment, principal_comment, next_term_begins, teacher_signature_url, principal_signature_url
             FROM report_card_meta
             WHERE student_id = $1 AND term = $2 AND session = $3`,
            [studentId, term, academicYear]
        );
        const reportMeta = reportMetaQuery.rows[0] || {};

        res.json({
            student: student,
            term: term,
            academic_year: academicYear,
            detailed_subject_results: detailedSubjectResults,
            overall_average: parseFloat(overallAverage.toFixed(2)),
            overall_grade: overallGrade,
            overall_remark: overallRemark,
            report_meta: reportMeta
        });

    } catch (error) {
        console.error("Error generating report card:", error);
        res.status(500).json({ error: "Failed to generate report card: " + error.message });
    } finally {
        client.release();
    }
});

// NEW: GET /api/exam-results/my-results - Get all results for the logged-in student
// This fixes the error on the student dashboard performance graph.

// GET /api/exam-results/my-results - Get all results for the logged-in student
// FIXED: Added exam_id to the SELECT statement so the dashboard can check which exams have results.
router.get("/my-results", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        if (req.user.role !== 'student') {
            return res.status(403).json({ error: "Access denied. Only students can view their results." });
        }

        const resultsQuery = await pool.query(
            `SELECT
                er.result_id,
                er.exam_id,
                er.score,
                er.submission_date,
                e.title AS exam_title
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.exam_id
            WHERE er.student_id = $1
            ORDER BY er.submission_date DESC`,
            [userId]
        );
        res.json(resultsQuery.rows);
    } catch (error) {
        console.error("Error fetching student's own results:", error);
        res.status(500).json({ error: "Failed to fetch your exam results." });
    }
});


// GET /api/exam-results/:resultId - Get a single detailed exam result
router.get("/:resultId", auth, async (req, res) => {
    try {
        const { resultId } = req.params;
        const requestingUser = req.user;

        const resultQuery = await pool.query(
            `SELECT
                er.result_id, er.student_id, er.exam_id, er.score, er.raw_score_obtained,
                er.total_possible_marks, er.submission_date, er.answers,
                e.title AS exam_title, e.exam_type, e.duration_minutes, e.pass_mark,
                e.sections AS exam_sections_structure,
                s.name AS subject_name, cl.level_name AS class_level_name,
                u.username AS student_name, u.admission_number
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.exam_id
            JOIN subjects s ON e.subject_id = s.subject_id
            LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
            JOIN users u ON er.student_id = u.id
            WHERE er.result_id = $1`,
            [resultId]
        );

        if (resultQuery.rows.length === 0) {
            return res.status(404).json({ error: "Exam result not found." });
        }

        const resultData = resultQuery.rows[0];

        if (requestingUser.role === 'student' && requestingUser.id !== resultData.student_id) {
            return res.status(403).json({ error: "Unauthorized: You do not have permission to view this result." });
        }

        const questionsAttempted = [];
        const userAnswers = resultData.answers || {};
        const examSections = typeof resultData.exam_sections_structure === 'string' 
            ? JSON.parse(resultData.exam_sections_structure) 
            : resultData.exam_sections_structure;

        if (examSections && Array.isArray(examSections)) {
            examSections.forEach(section => {
                if (section.questions && Array.isArray(section.questions)) {
                    section.questions.forEach(question => {
                        const qIdString = String(question.question_id); // Ensure keys are strings for matching
                        questionsAttempted.push({
                            question_id: question.question_id,
                            question_text: question.question_text,
                            options: question.options,
                            correct_answer: question.correct_answer,
                            explanation: question.explanation,
                            user_answer: userAnswers[qIdString] || null
                        });
                    });
                }
            });
        }
        resultData.questions_attempted = questionsAttempted;
        delete resultData.answers;
        delete resultData.exam_sections_structure;

        res.json(resultData);

    } catch (error) {
        console.error("Error fetching detailed exam result:", error);
        res.status(500).json({ error: "Failed to fetch detailed exam result: " + error.message });
    }
});


// GET /api/exam-results/recent-attempts - Get recent exam attempts for the logged-in student
router.get("/recent-attempts", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        if (req.user.role !== 'student') {
            return res.status(403).json({ error: "Access denied. Only students can view recent attempts." });
        }

        const recentAttemptsQuery = await pool.query(
            `SELECT
                er.result_id,
                er.exam_id,
                er.score,
                er.submission_date,
                e.title AS exam_title,
                e.pass_mark,
                s.name AS subject_name
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.exam_id
            JOIN subjects s ON e.subject_id = s.subject_id
            WHERE er.student_id = $1
            ORDER BY er.submission_date DESC
            LIMIT 5`,
            [userId]
        );
        res.json(recentAttemptsQuery.rows);
    } catch (error) {
        console.error("Error fetching recent attempts:", error);
        res.status(500).json({ error: "Failed to fetch recent attempts." });
    }
});
// NEW ROUTE: GET /api/exam-results/exam/:examId/summary - Get summary of all student results for a specific exam
router.get("/exam/:examId/summary", auth, async (req, res) => {
    try {
        const { examId } = req.params;
        const requestingUser = req.user;

        // Authorization: Only teachers (who created the exam) and admins can view this summary
        const examQuery = await pool.query(`SELECT created_by FROM exams WHERE exam_id = $1`, [examId]);
        if (examQuery.rows.length === 0) {
            return res.status(404).json({ error: "Exam not found." });
        }
        const examCreatorId = examQuery.rows[0].created_by;

        if (!requestingUser.is_admin && (requestingUser.role !== 'teacher' || requestingUser.id !== examCreatorId)) {
            return res.status(403).json({ error: "Unauthorized: You do not have permission to view this exam's results summary." });
        }

        const resultsQuery = await pool.query(
            `SELECT
                er.result_id,
                er.student_id,
                er.score,
                er.raw_score_obtained,
                er.total_possible_marks,
                er.submission_date,
                u.username AS student_name,
                u.admission_number,
                e.title AS exam_title,
                e.exam_type,
                s.name AS subject_name,
                cl.level_name AS class_level_name
            FROM exam_results er
            JOIN users u ON er.student_id = u.id
            JOIN exams e ON er.exam_id = e.exam_id
            JOIN subjects s ON e.subject_id = s.subject_id
            LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
            WHERE er.exam_id = $1
            ORDER BY u.username ASC`,
            [examId]
        );

        res.json(resultsQuery.rows);

    } catch (error) {
        console.error("Error fetching exam summary results:", error);
        res.status(500).json({ error: "Failed to fetch exam summary results: " + error.message });
    }
});

// NEW ROUTE: GET /api/exam-results/all - Get all exam results (Admin only)
router.get("/all", auth, async (req, res) => {
    try {
        const requestingUser = req.user;

        // Authorization: Only admins can view all results
        if (!requestingUser.is_admin) {
            return res.status(403).json({ error: "Unauthorized: Only administrators can view all exam results." });
        }

        const allResultsQuery = await pool.query(
            `SELECT
                er.result_id,
                er.student_id,
                er.score,
                er.raw_score_obtained,
                er.total_possible_marks,
                er.submission_date,
                u.username AS student_name,
                u.admission_number,
                e.title AS exam_title,
                e.exam_type,
                s.name AS subject_name,
                cl.level_name AS class_level_name
            FROM exam_results er
            JOIN users u ON er.student_id = u.id
            JOIN exams e ON er.exam_id = e.exam_id
            JOIN subjects s ON e.subject_id = s.subject_id
            LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
            ORDER BY er.submission_date DESC`
        );

        res.json(allResultsQuery.rows);

    } catch (error) {
        console.error("Error fetching all exam results:", error);
        res.status(500).json({ error: "Failed to fetch all exam results: " + error.message });
    }
});


// POST /api/exam-results - Submit exam result (from examSession.js)
router.post("/", auth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { studentId, examId, score, raw_score_obtained, total_possible_marks, answers, time_taken_seconds } = req.body;

        // Basic validation
        if (!studentId || !examId || score === undefined || raw_score_obtained === undefined || total_possible_marks === undefined || !answers || time_taken_seconds === undefined) {
            return res.status(400).json({ error: "Missing required fields for exam result submission." });
        }

        // Check if the requesting user is the student submitting or an admin
        if (req.user.id !== parseInt(studentId) && !req.user.is_admin) {
            return res.status(403).json({ error: "Unauthorized: You can only submit results for yourself." });
        }

        // Insert or update the exam result
        const resultInsertQuery = await client.query(
            `INSERT INTO exam_results (student_id, exam_id, score, raw_score_obtained, total_possible_marks, answers, time_taken_seconds)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (student_id, exam_id) DO UPDATE SET
                score = EXCLUDED.score,
                raw_score_obtained = EXCLUDED.raw_score_obtained,
                total_possible_marks = EXCLUDED.total_possible_marks,
                answers = EXCLUDED.answers,
                submission_date = NOW(),
                time_taken_seconds = EXCLUDED.time_taken_seconds
             RETURNING result_id;`,
            [studentId, examId, score, raw_score_obtained, total_possible_marks, JSON.stringify(answers), time_taken_seconds]
        );

        await client.query('COMMIT');
        res.status(201).json({ message: "Exam result submitted successfully.", resultId: resultInsertQuery.rows[0].result_id });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error submitting exam result:", error);
        res.status(500).json({ error: "Failed to submit exam result: " + error.message });
    } finally {
        client.release();
    }
});


// POST /api/report-card-meta - Create or Update report card metadata
router.post('/report-card-meta', auth, isAdminOrTeacher, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { studentId, term, session, teacher_comment, principal_comment, next_term_begins, teacher_signature_url, principal_signature_url } = req.body;

        if (!studentId || !term || !session) {
            return res.status(400).json({ error: "Student ID, term, and session are required." });
        }

        // Upsert operation: Insert if not exists, update if exists
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
    console.error("Error deleting report card meta data:", error);
    res.status(500).json({ error: "Failed to delete report card meta data." });
  }
});

module.exports = router;

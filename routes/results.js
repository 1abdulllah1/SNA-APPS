const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const auth = require("../middlewares/auth");

// Get exam results for current logged-in student (My Results on dashboard)
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id; // Add this line
    // Verify required columns exist
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'exam_results'
        AND column_name IN ('score', 'submission_date')
    `);
    
    if (columnCheck.rows.length < 2) {
      throw new Error("Missing required database columns");
    }
// Fixed query (remove comma after exam_type)
const result = await pool.query(`
  SELECT r.result_id, 
         e.exam_id,
         e.title AS exam_title, 
         e.exam_type,
         r.submission_date AS date,
         r.score,
         'Completed' AS status,
         e.duration_minutes
  FROM exam_results r
  JOIN exams e ON e.exam_id = r.exam_id
  WHERE r.student_id = $1
  ORDER BY r.submission_date DESC
`, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Results fetch error (/api/exam-results/):", error);
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

// Check if a student has completed a specific exam
router.get("/check-completion", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const examId = req.query.examId;
        if (!examId) {
            return res.status(400).json({ error: "Exam ID is required." });
        }
        const result = await pool.query(
            `SELECT score FROM exam_results WHERE student_id = $1 AND exam_id = $2`,
            [userId, examId]
        );
        if (result.rows.length > 0) {
            return res.json({ completed: true, score: result.rows[0].score });
        } else {
            return res.json({ completed: false });
        }
    } catch (error) {
        console.error("Check exam completion error:", error);
        res.status(500).json({ error: "Failed to check exam completion status." });
    }
});

// Endpoint for Admin to compile report card data
router.get("/compile-report", auth, async (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: "Admin access required." });
    }
    const { studentId, term, session } = req.query;
    if (!studentId || !term || !session) {
        return res.status(400).json({ error: "Student ID, term, and session are required." });
    }
    try {
        const studentQuery = await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.admission_number, u.class_level, u.profile_picture_url, 
                    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name='users' AND c.column_name='dob') 
                         THEN u.dob ELSE NULL END AS dob,
                    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name='users' AND c.column_name='gender') 
                         THEN u.gender ELSE NULL END AS gender
             FROM users u
             WHERE u.id = $1 AND u.role = 'student'`,
            [studentId]
        );

        if (studentQuery.rows.length === 0) {
            return res.status(404).json({ error: "Student not found." });
        }
        const student = studentQuery.rows[0];

        // Fetch exam results. This query needs to be adapted for CA/Exam structure.
        // Assuming 'exams' table now has 'subject_id', 'exam_type', 'max_score', 'term', 'session'
        // Assuming 'questions' table has 'marks'
        // Assuming 'exam_results' stores 'raw_score_obtained' and 'score' (percentage)
        const resultsQuery = await pool.query(`
            SELECT 
                e.exam_id, 
                e.title AS exam_title,
                e.exam_type, 
                e.max_score AS exam_max_score, -- Max score for this exam instance
                s.subject_id,
                s.name AS subject_name,
                er.score AS student_percentage_score, -- Student's score as a percentage
                er.raw_score_obtained, -- Student's actual marks for this exam instance
                er.submission_date
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.exam_id
            JOIN subjects s ON e.subject_id = s.subject_id
            WHERE er.student_id = $1 
              AND e.term = $2 
              AND e.session = $3
            ORDER BY s.subject_id, e.exam_type;
        `, [studentId, term.toUpperCase(), session]);
        
        // Corrected line:
        const exam_results_processed = resultsQuery.rows.map(r => ({
            ...r,
            // exam_max_score is already selected, if it's null, default to 100 for calculation safety
            total_marks_for_exam_instance: r.exam_max_score || 100 
        }));
        
        // Further processing to group by subject and calculate CA/Exam totals will go here
        // For now, just sending the processed results for structure.
        // The complex aggregation logic for report card (CA + Exam per subject) is a major next step.

        const reportSubjects = {}; // This will hold aggregated data per subject
        let grandTotalObtainable = 0;
        let grandTotalScored = 0;

        exam_results_processed.forEach(r => {
            if (!reportSubjects[r.subject_id]) {
                reportSubjects[r.subject_id] = {
                    subject_name: r.subject_name,
                    subject_id: r.subject_id,
                    ca_total_raw: 0,
                    ca_max_raw: 0,
                    exam_raw_score: null,
                    exam_max_raw: null,
                    // Placeholders for report card values (e.g., scaled to 40 for CA, 60 for Exam)
                    ca_report_score: 0,
                    exam_report_score: 0,
                    subject_report_total: 0,
                    grade: '',
                    remark: ''
                };
            }
            const subjectEntry = reportSubjects[r.subject_id];

            if (r.exam_type && r.exam_type.toUpperCase().startsWith('CA')) {
                subjectEntry.ca_total_raw += (r.raw_score_obtained || 0);
                subjectEntry.ca_max_raw += (r.total_marks_for_exam_instance || 0);
            } else if (r.exam_type && r.exam_type.toUpperCase() === 'MAIN_EXAM') {
                subjectEntry.exam_raw_score = r.raw_score_obtained || 0;
                subjectEntry.exam_max_raw = r.total_marks_for_exam_instance || 0;
            }
        });

        // Example scaling and total calculation logic (adjust to your school's policy)
        const CA_REPORT_WEIGHT = 40;
        const EXAM_REPORT_WEIGHT = 60;
        const SUBJECT_REPORT_MAX = CA_REPORT_WEIGHT + EXAM_REPORT_WEIGHT;

        for (const subjectId in reportSubjects) {
            const subject = reportSubjects[subjectId];
            if (subject.ca_max_raw > 0) {
                subject.ca_report_score = (subject.ca_total_raw / subject.ca_max_raw) * CA_REPORT_WEIGHT;
            } else {
                subject.ca_report_score = 0; // Or handle as 'N/A' if no CAs were taken/recorded
            }

            if (subject.exam_max_raw > 0 && subject.exam_raw_score !== null) {
                subject.exam_report_score = (subject.exam_raw_score / subject.exam_max_raw) * EXAM_REPORT_WEIGHT;
            } else {
                subject.exam_report_score = 0; // Or handle as 'N/A'
            }
            
            subject.subject_report_total = subject.ca_report_score + subject.exam_report_score;
            const subjectPercentage = (subject.subject_report_total / SUBJECT_REPORT_MAX) * 100;
            const gradeInfo = getGradeAndRemark(subjectPercentage); // Ensure getGradeAndRemark is defined
            subject.grade = gradeInfo.grade;
            subject.remark = gradeInfo.remark;

            grandTotalScored += subject.subject_report_total;
            grandTotalObtainable += SUBJECT_REPORT_MAX;
        }
        
        const overall_average_percentage = grandTotalObtainable > 0 ? (grandTotalScored / grandTotalObtainable) * 100 : 0;
        const overall_grade_info = getGradeAndRemark(overall_average_percentage);


        const school_info = { name: "SEALED NECTAR ACADEMY", address: "15, Nasirudeen Street...", contact: "080865257209 ...", next_term_begins: "Date TBD" };
        const comments = { teacher_comment: "Good effort shown this term.", principal_comment: "Satisfactory progress."};
        const affective_psychomotor = { punctuality: '4', neatness: '5' }; // Mock
        const class_position = "N/A"; // Mock

        res.json({ 
            student, 
            term: term.toUpperCase(), 
            session, 
            subjects: Object.values(reportSubjects), 
            grand_total_scored: grandTotalScored.toFixed(1),
            grand_total_obtainable: grandTotalObtainable,
            overall_average_percentage: overall_average_percentage.toFixed(1),
            overall_grade: overall_grade_info.grade,
            overall_remark: overall_grade_info.remark,
            school_info, 
            comments, 
            affective_psychomotor, 
            class_position 
        });

    } catch (error) {
        console.error("Error compiling report card data (/api/exam-results/compile-report):", error);
        if (error.code === '42703') { 
             console.error(`Database schema error: A required column might be missing. Details: ${error.message}`);
             return res.status(500).json({ error: `Database schema error. (Missing: ${error.message.match(/column "([^"]+)"/)?.[1] || 'unknown column'})` });
        }
        res.status(500).json({ error: "Failed to compile report card data." });
    }
});

// GET SINGLE USER (for editing, Admin only)
router.get("/:userId", auth, async (req, res) => {
    // Remove the condition that allows non-admin to access
    try {
        const { userId } = req.params;
        if (isNaN(parseInt(userId))) return res.status(400).json({error: "Invalid User ID"});

        // Always allow admin to access any user
        const userQuery = await pool.query(
            `SELECT id, username, email, role, admission_number, first_name, last_name, class_level, is_admin, profile_picture_url,
                    to_char(dob, 'YYYY-MM-DD') as dob, gender 
             FROM users WHERE id = $1`, [userId]);
        if (userQuery.rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(userQuery.rows[0]);
    } catch (error) {
        console.error("Get single user error:", error);
        res.status(500).json({ error: "Failed to fetch user data" });
    }
});

router.get("/:examId", auth, async (req, res) => {
    // ... (rest of the /:examId route remains the same as previous correct version)
    const { examId } = req.params;
    const loggedInUserId = req.user.id;
    const loggedInUserRole = req.user.role;
    const isAdmin = req.user.is_admin;
    const viewMode = req.query.view; 

    if (isNaN(parseInt(examId))) {
        return res.status(400).json({ error: "Invalid exam ID format." });
    }

    try {
        const examDetailsQuery = await pool.query(
            `SELECT exam_id, title, description, duration_minutes, class_level, created_by, exam_type, max_score 
             FROM exams 
             WHERE exam_id = $1`,
            [examId]
        );

        if (examDetailsQuery.rows.length === 0) {
            return res.status(404).json({ error: "Exam not found." });
        }
        const examBasicInfo = examDetailsQuery.rows[0];

        if (viewMode === 'teacher' && loggedInUserRole === 'teacher' && examBasicInfo.created_by !== loggedInUserId && !req.user.is_admin) {
    return res.status(403).json({ error: "Not authorized to view results for this exam." });
}

        if (viewMode === 'admin' || (viewMode === 'teacher' && loggedInUserRole === 'teacher')) {
            const allResultsQuery = await pool.query(`
                SELECT 
                    er.result_id, er.student_id,
                    u.first_name, u.last_name, u.admission_number,
                    er.score, 
                    er.raw_score_obtained, -- Include raw_score_obtained
                    e.max_score AS exam_max_score, -- Max score of this exam instance
                    er.submission_date
                FROM exam_results er
                JOIN users u ON er.student_id = u.id
                JOIN exams e ON er.exam_id = e.exam_id -- Join exams to get max_score
                WHERE er.exam_id = $1
                ORDER BY er.score DESC, u.last_name ASC;
            `, [examId]);
            res.json({ exam: examBasicInfo, results: allResultsQuery.rows, viewMode: isAdmin ? 'admin' : 'teacher' });
        } else { 
            const studentResultQuery = await pool.query(`
                SELECT er.score AS student_score, er.raw_score_obtained, er.submission_date, er.answers AS student_answers 
                FROM exam_results er
                WHERE er.exam_id = $1 AND er.student_id = $2
            `, [examId, loggedInUserId]);

            if (studentResultQuery.rows.length === 0) {
                 return res.status(404).json({ error: "You have not taken this exam or no result found." });
            }
            const studentSubmissionDetails = studentResultQuery.rows[0];

            const questionsResult = await pool.query(
                `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks
                 FROM questions WHERE exam_id = $1 ORDER BY question_id ASC`,
                [examId]
            );
            
            let submittedAnswers = studentSubmissionDetails.student_answers || {};

            const questionsWithReview = questionsResult.rows.map(q => ({
                question_id: q.question_id, question_text: q.question_text,
                options: [ { id: 'a', text: q.option_a }, { id: 'b', text: q.option_b }, { id: 'c', text: q.option_c }, { id: 'd', text: q.option_d } ],
                correct_answer: q.correct_answer, student_answer: submittedAnswers[q.question_id.toString()],
                explanation: q.explanation,
                marks: q.marks
            }));
            res.json({ exam: { ...examBasicInfo, ...studentSubmissionDetails }, questions: questionsWithReview, viewMode: 'student' });
        }
    } catch (error) {
        console.error(`Detailed results fetch error (/api/exam-results/${examId}):`, error);
        if (error.code === '42703' && error.message.includes('column "answers" does not exist')) {
             console.error("DATABASE SCHEMA ERROR: The 'answers' column is missing from the 'exam_results' table.");
             return res.status(500).json({ error: "Database schema error: 'answers' column missing. Contact administrator." });
        }
        res.status(500).json({ error: "Failed to fetch detailed exam results." });
    }
});

// Helper function for grading (ensure this is defined or imported)
function getGradeAndRemark(percentage) {
    if (percentage >= 90) return { grade: 'A1', remark: 'Distinction' };
    if (percentage >= 80) return { grade: 'A2', remark: 'Excellent' };
    if (percentage >= 70) return { grade: 'B2', remark: 'Very Good' };
    if (percentage >= 65) return { grade: 'B3', remark: 'Good' };
    if (percentage >= 60) return { grade: 'C4', remark: 'Credit' };
    if (percentage >= 55) return { grade: 'C5', remark: 'Credit' };
    if (percentage >= 50) return { grade: 'C6', remark: 'Pass' };
    if (percentage >= 45) return { grade: 'D7', remark: 'Pass' };
    if (percentage >= 40) return { grade: 'E8', remark: 'Fair' };
    return { grade: 'F9', remark: 'Fail' };
}

module.exports = router;

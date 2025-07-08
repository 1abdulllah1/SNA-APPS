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
                    } else {
                        // Everything else is a CA (CA1, CA2, CA3, CA4, MID_TERM, OTHER)
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
                    // Scale CA score to 40%
                    const ca_scaled = totalCAMaxScore > 0 ? (totalCAScore / totalCAMaxScore) * 40 : 0;

                    // Calculate exam score (scaled to 60)
                    const exam_scaled = scores.EXAM && scores.EXAM.maxScore > 0 ? (scores.EXAM.score / scores.EXAM.maxScore) * 60 : 0;

                    const finalScore = ca_scaled + exam_scaled;
                    const { grade, remark } = getGradeAndRemark(finalScore);

                    if (scores.CAs.length > 0 || scores.EXAM) {
                        totalFinalScore += finalScore;
                        subjectsWithScoresCount++;
                    }

                    processedSubjects.push({
                        subjectName,
                        ca_scaled: ca_scaled,
                        exam_scaled: exam_scaled,
                        finalScore: finalScore,
                        grade,
                        remark
                    });
                });

                const overallPercentage = subjectsWithScoresCount > 0 ? (totalFinalScore / subjectsWithScoresCount) : 0;

                return {
                    studentId: id,
                    totalFinalScore, // Sum of final scores for all subjects
                    overallPercentage, // Average percentage across all subjects
                    subjects: processedSubjects // Detailed scores for each subject
                };
            });

            // Sort students by overall percentage for ranking
            allStudentsProcessedData.sort((a, b) => b.overallPercentage - a.overallPercentage);

            // Determine position for each student
            allStudentsProcessedData.forEach((data, index) => {
                data.position = `${index + 1}${getOrdinalSuffix(index + 1)} of ${allStudentsProcessedData.length}`;
            });

            classReportData = allStudentsProcessedData;
        }

        // Extract the target student's data and position
        const targetStudentReport = classReportData.find(data => data.studentId === studentId);

        // Fetch cumulative data (previous terms)
        const cumulativeMetaDataQuery = await client.query(
            `SELECT cumulative_data FROM report_card_meta WHERE student_id = $1 AND term = $2 AND session = $3`,
            [studentId, term, academicYear]
        );
        const cumulativeData = cumulativeMetaDataQuery.rows[0]?.cumulative_data || [];


        res.json({
            student: student,
            reportCardData: targetStudentReport || { subjects: [] }, // Ensure subjects array is present
            summary: {
                totalScoreObtained: targetStudentReport?.totalFinalScore || 0,
                overallPercentage: targetStudentReport?.overallPercentage || 0,
                position: targetStudentReport?.position || 'N/A'
            },
            metadata: {
                teacher_comment: cumulativeMetaDataQuery.rows[0]?.teacher_comment || '',
                principal_comment: cumulativeMetaDataQuery.rows[0]?.principal_comment || '',
                next_term_begins: cumulativeMetaDataQuery.rows[0]?.next_term_begins || null,
                cumulative_data: cumulativeData // Send cumulative data
            }
        });

    } catch (error) {
        console.error("Error generating report card:", error);
        res.status(500).json({ error: "Failed to generate report card: " + error.message });
    } finally {
        client.release();
    }
});


// GET /api/exam-results/student/:studentId - Get all exam results for a specific student
router.get("/student/:studentId", auth, async (req, res) => {
    try {
        const { studentId } = req.params;
        const requestingUser = req.user;

        // Authorization: Students can only view their own results. Admins/Teachers can view any.
        if (!requestingUser.is_admin && requestingUser.role !== 'teacher' && requestingUser.id !== parseInt(studentId)) {
            return res.status(403).json({ error: "Unauthorized to view these results." });
        }

        const result = await pool.query(
            `SELECT er.result_id, er.exam_id, er.score, er.raw_score_obtained, er.total_possible_marks, er.submission_date,
                    e.title as exam_title, e.duration_minutes, e.exam_type, e.term, e.session,
                    s.name as subject_name, cl.level_name as class_level_name
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             LEFT JOIN subjects s ON e.subject_id = s.subject_id
             LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
             WHERE er.student_id = $1
             ORDER BY er.submission_date DESC`,
            [studentId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching student exam results:", error);
        res.status(500).json({ error: "Failed to fetch student exam results." });
    }
});

// GET /api/exam-results/:resultId - Get a single exam result with answers for review
router.get("/:resultId", auth, async (req, res) => {
    try {
        const { resultId } = req.params;
        const requestingUser = req.user;

        const resultQuery = await pool.query(
            `SELECT er.result_id, er.student_id, er.exam_id, er.score, er.raw_score_obtained, er.total_possible_marks,
                    er.answers, er.submission_date, er.time_taken_seconds,
                    e.title as exam_title, e.exam_instructions, e.duration_minutes, e.exam_type, e.max_score, e.pass_mark,
                    e.term, e.session, s.name as subject_name, cl.level_name as class_level_name
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             LEFT JOIN subjects s ON e.subject_id = s.subject_id
             LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
             WHERE er.result_id = $1`,
            [resultId]
        );

        if (resultQuery.rows.length === 0) {
            return res.status(404).json({ error: "Exam result not found." });
        }

        const examResult = resultQuery.rows[0];

        // Authorization: Students can only view their own detailed results. Admins/Teachers can view any.
        if (!requestingUser.is_admin && requestingUser.role !== 'teacher' && requestingUser.id !== examResult.student_id) {
            return res.status(403).json({ error: "Unauthorized to view this detailed result." });
        }

        // Fetch exam sections and questions
        const sectionsQuery = await pool.query(
            `SELECT section_id, section_name, section_instructions, section_order
             FROM exam_sections WHERE exam_id = $1 ORDER BY section_order ASC`,
            [examResult.exam_id]
        );

        const sections = [];
        for (const sectionRow of sectionsQuery.rows) {
            const questionsQuery = await pool.query(
                `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks
                 FROM questions WHERE section_id = $1 ORDER BY question_id ASC`,
                [sectionRow.section_id]
            );
            sections.push({
                ...sectionRow,
                questions: questionsQuery.rows,
            });
        }

        // Combine exam result with questions and user's answers
        const userAnswers = examResult.answers || {}; // Ensure it's an object
        const detailedResult = {
            ...examResult,
            sections: sections.map(section => ({
                ...section,
                questions: section.questions.map(question => ({
                    ...question,
                    user_answer: userAnswers[question.question_id] || null,
                    is_correct: userAnswers[question.question_id] === question.correct_answer,
                }))
            }))
        };

        res.json(detailedResult);
    } catch (error) {
        console.error("Error fetching detailed exam result:", error);
        res.status(500).json({ error: "Failed to fetch detailed exam result: " + error.message });
    }
});

// GET /api/exam-results/exam/:examId/all - Get summary of all results for a specific exam (for teacher/admin)
router.get("/exam/:examId/all", auth, async (req, res) => {
    try {
        const { examId } = req.params;
        const requestingUser = req.user;

        // Authorization: Only admin and teacher can view this summary
        if (!requestingUser.is_admin && requestingUser.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized to view exam results summary." });
        }

        const result = await pool.query(
            `SELECT er.result_id, er.student_id, er.score, er.raw_score_obtained, er.total_possible_marks, er.submission_date,
                    u.username as student_name, u.admission_number,
                    e.title as exam_title, e.exam_type, e.term, e.session
             FROM exam_results er
             JOIN users u ON er.student_id = u.id
             JOIN exams e ON er.exam_id = e.exam_id
             WHERE er.exam_id = $1
             ORDER BY er.submission_date DESC`,
            [examId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching exam results summary:", error);
        res.status(500).json({ error: "Failed to fetch exam results summary." });
    }
});

/**
 * @route PUT /api/exam-results/report-card-meta
 * @description Update report card metadata (teacher/principal comments, next term begins date). Admin or Teacher only.
 * @access AdminOrTeacher
 */
router.put('/report-card-meta', auth, async (req, res) => {
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

        // Fetch existing cumulative data if any
        const existingMeta = await client.query(
            `SELECT cumulative_data FROM report_card_meta WHERE student_id = $1 AND term = $2 AND session = $3`,
            [studentId, term, session]
        );
        let cumulativeData = existingMeta.rows[0]?.cumulative_data || [];

        // Re-calculate cumulative data based on current term's results
        // This ensures the cumulative data is always up-to-date when comments are saved.
        const studentResultsQuery = await client.query(
            `SELECT er.student_id, er.score, e.exam_type, s.name as subject_name, e.max_score
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             LEFT JOIN subjects s ON e.subject_id = s.subject_id
             WHERE er.student_id = $1 AND e.term = $2 AND e.session = $3`,
            [studentId, term, session]
        );

        const subjectsMap = new Map();
        studentResultsQuery.rows.forEach(res => {
            if (!res.subject_name) return;
            if (!subjectsMap.has(res.subject_name)) {
                subjectsMap.set(res.subject_name, { CAs: [], EXAM: null });
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

        const newCumulativeData = [];
        subjectsMap.forEach((scores, subjectName) => {
            let totalCAScore = 0;
            let totalCAMaxScore = 0;
            scores.CAs.forEach(ca => {
                totalCAScore += ca.score;
                totalCAMaxScore += ca.maxScore;
            });
            const ca_scaled = totalCAMaxScore > 0 ? (totalCAScore / totalCAMaxScore) * 40 : 0;

            const exam_scaled = scores.EXAM && scores.EXAM.maxScore > 0 ? (scores.EXAM.score / scores.EXAM.maxScore) * 60 : 0;
            const finalScore = ca_scaled + exam_scaled;

            newCumulativeData.push({
                subjectName,
                firstTerm: term === 'FIRST' ? finalScore : null,
                secondTerm: term === 'SECOND' ? finalScore : null,
                thirdTerm: term === 'THIRD' ? finalScore : null,
                cumulativeAvg: finalScore // For now, cumulative is just current term. Logic can be expanded later.
            });
        });

        // Merge with existing cumulative data if needed (e.g., if updating a previous term's comments)
        // For simplicity, this currently overwrites the current term's data in cumulative_data.
        // A more robust solution would merge based on subjectName and term.
        // For now, it's assumed cumulative_data stores the *current* term's scores when saving metadata.
        // If you need true cumulative average across terms, that logic needs to be added here.
        
        const insertOrUpdateQuery = `
            INSERT INTO report_card_meta (student_id, term, session, teacher_comment, principal_comment, next_term_begins, cumulative_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
            ON CONFLICT (student_id, term, session) DO UPDATE SET
                teacher_comment = EXCLUDED.teacher_comment,
                principal_comment = EXCLUDED.principal_comment,
                next_term_begins = EXCLUDED.next_term_begins,
                cumulative_data = EXCLUDED.cumulative_data,
                updated_at = NOW()
            RETURNING *;
        `;

        const result = await client.query(
            insertOrUpdateQuery,
            [studentId, term, session, teacher_comment, principal_comment, next_term_begins, JSON.stringify(newCumulativeData)] // cumulativeData as JSON string
        );

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
    console.error("Error deleting report card meta data:", error);
    res.status(500).json({ error: "Failed to delete report card meta data." });
  }
});


module.exports = router;

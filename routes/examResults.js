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
    if (p >= 50) return { grade: 'C6', remark: 'Average' };
    if (p >= 45) return { grade: 'D7', remark: 'Fair' };
    if (p >= 40) return { grade: 'E8', remark: 'Weak Pass' };
    return { grade: 'F9', remark: 'Fail' };
}

/**
 * @route GET /api/exam-results/all
 * @description Get all exam results. Accessible by Admin and Teacher.
 * @access Admin, Teacher
 */
router.get('/all', auth, isAdminOrTeacher, async (req, res) => {
    try {
        // Add filters for exam_name, class_level_id, subject_id, and student_id
        const { exam_name, class_level_id, subject_id, student_id } = req.query;
        let query = `
            SELECT
                er.result_id,
                er.student_id,
                u.username AS student_username, -- Changed to student_username
                u.full_name AS student_full_name, -- Added student_full_name
                u.admission_number,
                e.exam_id,
                e.title AS exam_title,
                s.name AS subject_name,
                cl.level_name AS class_level_name,
                er.score,
                er.raw_score_obtained,
                er.total_possible_marks,
                er.submission_date,
                er.time_taken_seconds,
                er.exam_version_timestamp,
                er.answers AS student_answers,
                e.exam_type,
                e.term,
                e.session
            FROM exam_results er
            JOIN users u ON er.student_id = u.id
            JOIN exams e ON er.exam_id = e.exam_id
            LEFT JOIN subjects s ON e.subject_id = s.subject_id
            LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (exam_name) {
            query += ` AND LOWER(e.title) LIKE LOWER($${paramIndex++})`;
            params.push(`%${exam_name}%`);
        }
        if (class_level_id) {
            query += ` AND e.class_level_id = $${paramIndex++}`;
            params.push(class_level_id);
        }
        if (subject_id) {
            query += ` AND e.subject_id = $${paramIndex++}`;
            params.push(subject_id);
        }
        if (student_id) { // New filter for student_id
            query += ` AND er.student_id = $${paramIndex++}`;
            params.push(student_id);
        }

        query += ` ORDER BY er.submission_date DESC;`;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching all exam results:", error);
        res.status(500).json({ error: "Failed to fetch all exam results." });
    }
});

/**
 * @route GET /api/exam-results/my-results
 * @description Get all exam results for the authenticated student.
 * @access Student
 */
router.get('/my-results', auth, async (req, res) => {
    const studentId = req.user.id;
    try {
        // Add filters for exam_name, class_level_id, subject_id
        const { exam_name, class_level_id, subject_id } = req.query;
        let query = `
            SELECT
                er.result_id,
                er.student_id,
                u.username AS student_username,
                u.full_name AS student_full_name,
                u.admission_number,
                e.exam_id,
                e.title AS exam_title,
                s.name AS subject_name,
                cl.level_name AS class_level_name,
                er.score,
                er.raw_score_obtained,
                er.total_possible_marks,
                er.submission_date,
                er.time_taken_seconds,
                er.exam_version_timestamp,
                er.answers AS student_answers,
                e.exam_type,
                e.term,
                e.session
            FROM exam_results er
            JOIN users u ON er.student_id = u.id
            JOIN exams e ON er.exam_id = e.exam_id
            LEFT JOIN subjects s ON e.subject_id = s.subject_id
            LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
            WHERE er.student_id = $1
        `;
        const params = [studentId];
        let paramIndex = 2; // Start from 2 because $1 is studentId

        if (exam_name) {
            query += ` AND LOWER(e.title) LIKE LOWER($${paramIndex++})`;
            params.push(`%${exam_name}%`);
        }
        if (class_level_id) {
            query += ` AND e.class_level_id = $${paramIndex++}`;
            params.push(class_level_id);
        }
        if (subject_id) {
            query += ` AND e.subject_id = $${paramIndex++}`;
            params.push(subject_id);
        }

        query += ` ORDER BY er.submission_date DESC;`;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching student's exam results:", error);
        res.status(500).json({ error: "Failed to fetch your exam results." });
    }
});

/**
 * @route GET /api/exam-results/exam/:examId/all-students
 * @description Get all exam results for a specific exam, across all students. Accessible by Admin and Teacher.
 * @access Admin, Teacher
 */
router.get('/exam/:examId/all-students', auth, isAdminOrTeacher, async (req, res) => {
    const { examId } = req.params;

    if (isNaN(parseInt(examId))) {
        return res.status(400).json({ error: "Invalid Exam ID format." });
    }

    try {
        const query = `
            SELECT
                er.result_id,
                er.student_id,
                u.username AS student_username,
                u.full_name AS student_full_name,
                u.admission_number,
                e.exam_id,
                e.title AS exam_title,
                s.name AS subject_name,
                cl.level_name AS class_level_name,
                er.score,
                er.raw_score_obtained,
                er.total_possible_marks,
                er.submission_date,
                er.time_taken_seconds,
                er.exam_version_timestamp,
                er.answers AS student_answers,
                e.exam_type,
                e.term,
                e.session
            FROM exam_results er
            JOIN users u ON er.student_id = u.id
            JOIN exams e ON er.exam_id = e.exam_id
            LEFT JOIN subjects s ON e.subject_id = s.subject_id
            LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
            WHERE er.exam_id = $1
            ORDER BY u.full_name ASC, er.submission_date DESC;
        `;
        const { rows } = await pool.query(query, [examId]);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching all student results for specific exam:", error);
        res.status(500).json({ error: "Failed to fetch exam results for this exam." });
    }
});


/**
 * @route GET /api/exam-results/:resultId
 * @description Get a specific exam result by result_id. Accessible by Admin, Teacher, or the student who owns the result.
 * @access Admin, Teacher, or Owner Student
 */
router.get('/:resultId', auth, async (req, res) => {
    const { resultId } = req.params;
    const requestingUser = req.user;

    if (isNaN(parseInt(resultId))) {
        return res.status(400).json({ error: "Invalid Result ID format." });
    }

    try {
        const client = await pool.connect();
        const resultQuery = `
            SELECT
                er.result_id,
                er.student_id,
                u.username AS student_username,
                u.full_name AS student_full_name,
                u.admission_number,
                e.exam_id,
                e.title AS exam_title,
                e.description AS exam_description,
                e.duration_minutes,
                e.pass_mark,
                e.exam_type,
                e.term,
                e.session,
                s.name AS subject_name,
                cl.level_name AS class_level_name,
                er.score,
                er.raw_score_obtained,
                er.total_possible_marks,
                er.submission_date,
                er.time_taken_seconds,
                er.answers AS student_answers,
                e.updated_at AS exam_version_timestamp,
                e.sections AS exam_sections_structure -- Fetch the stored sections structure
            FROM exam_results er
            JOIN users u ON er.student_id = u.id
            JOIN exams e ON er.exam_id = e.exam_id
            LEFT JOIN subjects s ON e.subject_id = s.subject_id
            LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
            WHERE er.result_id = $1;
        `;
        const result = await client.query(resultQuery, [resultId]);

        if (result.rows.length === 0) {
            client.release();
            return res.status(404).json({ error: "Exam result not found." });
        }

        const examResult = result.rows[0];

        // Authorization check: Admin/Teacher can view any result, student can only view their own
        if (!requestingUser.is_admin && requestingUser.role !== 'teacher' && requestingUser.id !== parseInt(examResult.student_id)) {
            client.release();
            return res.status(403).json({ error: "Access denied. You can only view your own exam results." });
        }

        // Use the stored exam_sections_structure to get question order and details
        let questionsForReview = [];
        console.log('Exam Sections Structure:', examResult.exam_sections_structure); // Debugging
        if (examResult.exam_sections_structure && Array.isArray(examResult.exam_sections_structure)) {
            for (const section of examResult.exam_sections_structure) {
                // Ensure section.questions exists and is an array before iterating
                if (section.questions && Array.isArray(section.questions)) {
                    for (const q of section.questions) {
                        // Fetch full question details including correct_answer, explanation, AND marks
                        const fullQuestionQuery = await client.query(
                            `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks
                             FROM questions WHERE question_id = $1`,
                            [q.question_id]
                        );
                        if (fullQuestionQuery.rows.length > 0) {
                            const fullQ = fullQuestionQuery.rows[0];
                            questionsForReview.push({
                                question_id: fullQ.question_id,
                                question_text: fullQ.question_text,
                                options: { A: fullQ.option_a, B: fullQ.option_b, C: fullQ.option_c, D: fullQ.option_d },
                                correct_answer: fullQ.correct_answer,
                                explanation: fullQ.explanation,
                                marks: fullQ.marks // Include marks
                            });
                        } else {
                            console.warn(`Question ID ${q.question_id} not found in questions table for exam result ${resultId}.`);
                        }
                    }
                }
            }
        }
        examResult.questions = questionsForReview;
        console.log('Questions for Review:', examResult.questions); // Debugging
        delete examResult.exam_sections_structure; // Clean up the response

        client.release();
        res.json(examResult);

    } catch (error) {
        console.error("Error fetching detailed exam result:", error);
        res.status(500).json({ error: "Failed to fetch detailed exam result: " + error.message });
    }
});

/**
 * @route GET /api/exam-results/student/:studentId/exam/:examId
 * @description Get a specific exam result for a given student and exam. Accessible by Admin, Teacher, or the student themselves.
 * @access Admin, Teacher, or Owner Student
 */
router.get('/student/:studentId/exam/:examId', auth, async (req, res) => {
    const { studentId, examId } = req.params;
    const requestingUser = req.user;

    if (isNaN(parseInt(studentId)) || isNaN(parseInt(examId))) {
        return res.status(400).json({ error: "Invalid ID format." });
    }

    // Authorization check: Admin/Teacher can view any result, student can only view their own
    if (!requestingUser.is_admin && requestingUser.role !== 'teacher' && requestingUser.id !== parseInt(studentId)) {
        return res.status(403).json({ error: "Access denied. You can only view your own exam results." });
    }

    try {
        const client = await pool.connect();
        const resultQuery = `
            SELECT
                er.result_id,
                er.student_id,
                u.username AS student_username,
                u.full_name AS student_full_name,
                u.admission_number,
                e.exam_id,
                e.title AS exam_title,
                e.description AS exam_description,
                e.duration_minutes,
                e.pass_mark,
                e.exam_type,
                e.term,
                e.session,
                s.name AS subject_name,
                cl.level_name AS class_level_name,
                er.score,
                er.raw_score_obtained,
                er.total_possible_marks,
                er.submission_date,
                er.time_taken_seconds,
                er.answers AS student_answers,
                e.updated_at AS exam_version_timestamp,
                e.sections AS exam_sections_structure -- Fetch the stored sections structure
            FROM exam_results er
            JOIN users u ON er.student_id = u.id
            JOIN exams e ON er.exam_id = e.exam_id
            LEFT JOIN subjects s ON e.subject_id = s.subject_id
            LEFT JOIN class_levels cl ON e.class_level_id = cl.level_id
            WHERE er.student_id = $1 AND er.exam_id = $2;
        `;
        const result = await client.query(resultQuery, [studentId, examId]);

        if (result.rows.length === 0) {
            client.release();
            return res.status(404).json({ error: "Exam result not found for this student and exam." });
        }

        const examResult = result.rows[0];

        // Fetch all questions related to this exam, including their options and correct answers
        // Use the stored exam_sections_structure to get question order and details
        let questionsForReview = [];
        console.log('Exam Sections Structure (student/exam route):', examResult.exam_sections_structure); // Debugging
        if (examResult.exam_sections_structure && Array.isArray(examResult.exam_sections_structure)) {
            for (const section of examResult.exam_sections_structure) {
                 // Ensure section.questions exists and is an array before iterating
                if (section.questions && Array.isArray(section.questions)) {
                    for (const q of section.questions) {
                        // Fetch full question details including correct_answer, explanation, AND marks
                        const fullQuestionQuery = await client.query(
                            `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, marks
                             FROM questions WHERE question_id = $1`,
                            [q.question_id]
                        );
                        if (fullQuestionQuery.rows.length > 0) {
                            const fullQ = fullQuestionQuery.rows[0];
                            questionsForReview.push({
                                question_id: fullQ.question_id,
                                question_text: fullQ.question_text,
                                options: { A: fullQ.option_a, B: fullQ.option_b, C: fullQ.option_c, D: fullQ.option_d },
                                correct_answer: fullQ.correct_answer,
                                explanation: fullQ.explanation,
                                marks: fullQ.marks // Include marks
                            });
                        } else {
                            console.warn(`Question ID ${q.question_id} not found in questions table for student ${studentId}, exam ${examId}.`);
                        }
                    }
                }
            }
        }
        examResult.questions = questionsForReview;
        console.log('Questions for Review (student/exam route):', examResult.questions); // Debugging
        delete examResult.exam_sections_structure; // Clean up the response

        client.release();
        res.json(examResult);

    } catch (error) {
        console.error("Error fetching specific student exam result:", error);
        res.status(500).json({ error: "Failed to fetch specific exam result: " + error.message });
    }
});


// --- Report Card Metadata Routes ---

/**
 * @route GET /api/exam-results/report-card-meta/:studentId/:term/:session
 * @description Get report card metadata for a specific student, term, and session.
 * @access Admin, Teacher, or Owner Student
 */
router.get('/report-card-meta/:studentId/:term/:session', auth, async (req, res) => {
    const { studentId, term, session } = req.params;
    const requestingUser = req.user;

    if (isNaN(parseInt(studentId))) {
        return res.status(400).json({ error: "Invalid Student ID format." });
    }

    // Authorization: Admin/Teacher can view any, student can only view their own
    if (!requestingUser.is_admin && requestingUser.role !== 'teacher' && requestingUser.id !== parseInt(studentId)) {
        return res.status(403).json({ error: "Access denied. You can only view your own report card." });
    }

    try {
        const result = await pool.query(
            `SELECT * FROM report_card_meta
             WHERE student_id = $1 AND term = $2 AND session = $3`,
            [studentId, term.toUpperCase(), session]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Report card metadata not found." });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching report card metadata:", error);
        res.status(500).json({ error: "Failed to fetch report card metadata." });
    }
});


/**
 * @route POST /api/exam-results/report-card-meta - Create or Update metadata
 * @description Create or update report card metadata. Admin or Teacher only.
 * @access Admin, Teacher
 */
router.post('/report-card-meta', auth, isAdminOrTeacher, async (req, res) => {
    const { studentId, term, session, teacher_comment, principal_comment, next_term_begins, teacher_signature_url, principal_signature_url, psychomotor_assessment, affective_domain, other_assessments, class_position, class_teacher_id } = req.body;

    if (!studentId || !term || !session) {
        return res.status(400).json({ error: "Student ID, term, and session are required." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const query = `
            INSERT INTO report_card_meta (student_id, term, session, teacher_comment, principal_comment, next_term_begins,
                                        psychomotor_assessment, affective_domain, other_assessments,
                                        teacher_signature_url, principal_signature_url, class_position, class_teacher_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (student_id, term, session)
            DO UPDATE SET
                teacher_comment = EXCLUDED.teacher_comment,
                principal_comment = EXCLUDED.principal_comment,
                next_term_begins = EXCLUDED.next_term_begins,
                psychomotor_assessment = EXCLUDED.psychomotor_assessment,
                affective_domain = EXCLUDED.affective_domain,
                other_assessments = EXCLUDED.other_assessments,
                teacher_signature_url = EXCLUDED.teacher_signature_url,
                principal_signature_url = EXCLUDED.principal_signature_url,
                class_position = EXCLUDED.class_position,
                class_teacher_id = EXCLUDED.class_teacher_id,
                updated_at = NOW()
            RETURNING *;
        `;
        const result = await pool.query(query, [
            studentId,
            term.toUpperCase(), // Ensure term is uppercase for consistency
            session,
            teacher_comment || null,
            principal_comment || null,
            next_term_begins || null,
            psychomotor_assessment ? JSON.stringify(psychomotor_assessment) : null,
            affective_domain ? JSON.stringify(affective_domain) : null,
            other_assessments ? JSON.stringify(other_assessments) : null,
            teacher_signature_url || null,
            principal_signature_url || null,
            class_position || null, // Save class position
            class_teacher_id || null // Save class teacher ID
        ]);
        res.status(200).json({ message: "Report card data saved successfully.", data: result.rows[0] });
    } catch (error) {
        console.error("Error saving report meta:", error);
        res.status(500).json({ error: "Failed to save report card data. " + error.message });
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
    console.error("Error deleting report card meta:", error);
    res.status(500).json({ error: "Failed to delete report card meta data." });
  }
});

/**
 * @route GET /api/exam-results/report-card/:studentId
 * @description Generate a comprehensive report card for a student for a specific term and academic year.
 * @access Admin, Teacher, or Owner Student
 */
router.get('/report-card/:studentId', auth, async (req, res) => {
    const { studentId } = req.params;
    // Extract term and session from query parameters
    const { term, session } = req.query;
    const requestingUser = req.user;

    if (isNaN(parseInt(studentId))) {
        return res.status(400).json({ error: "Invalid Student ID format." });
    }
    // Explicitly check for term and session presence from query
    if (!term || !session) {
        return res.status(400).json({ error: "Term and Session are required as query parameters for report card generation." });
    }

    // Authorization: Admin/Teacher can view any, student can only view their own
    if (!requestingUser.is_admin && requestingUser.role !== 'teacher' && requestingUser.id !== parseInt(studentId)) {
        return res.status(403).json({ error: "Access denied. You can only view your own report card." });
    }

    try {
        const client = await pool.connect();

        // 1. Fetch Student Details - Added full_name and department
        const studentQuery = await pool.query(
            `SELECT
                u.id, u.username, u.email, u.role, u.is_admin, u.admission_number, u.profile_picture_url, u.dob, u.gender,
                u.full_name, u.department,
                cl.level_name as class_level_name, cl.level_id as class_level_id -- Fetch class_level_id
             FROM users u
             LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id
             WHERE u.id = $1`,
            [studentId]
        );
        if (studentQuery.rows.length === 0) {
            client.release();
            return res.status(404).json({ error: "Student not found." });
        }
        const student = studentQuery.rows[0];

        // 2. Fetch Exams and Results for the specified term and academic year
        // This query fetches all results for the student for the given session
        const resultsQuery = `
            SELECT
                er.score,
                er.raw_score_obtained,
                er.total_possible_marks,
                e.title AS exam_title,
                e.exam_type,
                e.subject_id,
                s.name AS subject_name,
                e.term,
                e.session
            FROM exam_results er
            JOIN exams e ON er.exam_id = e.exam_id
            JOIN subjects s ON e.subject_id = s.subject_id
            WHERE er.student_id = $1
            AND e.session = $2
            ORDER BY s.name ASC, e.term_order ASC;
        `;
        const allSessionResults = await client.query(resultsQuery, [studentId, session]);

        // Aggregate results by subject and term for cumulative scores
        const subjectsData = {};
        const termsOrderMap = { 'FIRST': 1, 'SECOND': 2, 'THIRD': 3 };

        allSessionResults.rows.forEach(row => {
            if (!subjectsData[row.subject_id]) {
                subjectsData[row.subject_id] = {
                    subject_name: row.subject_name,
                    term_scores: { 'FIRST': null, 'SECOND': null, 'THIRD': null }, // Initialize as object with nulls
                    term_possible_marks: { 'FIRST': null, 'SECOND': null, 'THIRD': null }, // Initialize as object with nulls
                    cumulative_score: 0,
                    cumulative_possible_marks: 0,
                    exams: []
                };
            }

            const currentSubject = subjectsData[row.subject_id];

            // Safely get termKey
            const termKey = row.term ? row.term.toUpperCase() : null;

            // Assign raw_score_obtained to the correct term property
            if (termKey && termsOrderMap[termKey]) { // Check if termKey is valid and exists in termsOrderMap
                // Only update if the current score is higher or if it's the first score for that term
                if (currentSubject.term_scores[termKey] === null || row.raw_score_obtained > currentSubject.term_scores[termKey]) {
                    currentSubject.term_scores[termKey] = row.raw_score_obtained;
                    currentSubject.term_possible_marks[termKey] = row.total_possible_marks; // Also update possible marks
                }
            } else {
                console.warn(`Invalid or missing term for exam result: ${JSON.stringify(row)}`);
            }


            // Add to cumulative if it's the current term or a preceding term
            if (termKey && termsOrderMap[termKey] <= termsOrderMap[term.toUpperCase()]) {
                currentSubject.cumulative_score += row.raw_score_obtained;
                currentSubject.cumulative_possible_marks += row.total_possible_marks;
            }

            currentSubject.exams.push({
                exam_title: row.exam_title,
                score: row.score,
                raw_score_obtained: row.raw_score_obtained,
                total_possible_marks: row.total_possible_marks,
                exam_type: row.exam_type,
                term: row.term
            });
        });

        let totalOverallScore = 0;
        let totalOverallPossibleMarks = 0;
        let totalSubjectsTaken = 0;

        const aggregatedResults = Object.values(subjectsData).map(subject => {
            totalSubjectsTaken++;

            const aggregateScore = subject.cumulative_score;
            const totalPossibleForAggregate = subject.cumulative_possible_marks;

            const percentage = totalPossibleForAggregate > 0 ? (aggregateScore / totalPossibleForAggregate) * 100 : 0;
            const { grade, remark } = getGradeAndRemark(parseFloat(percentage.toFixed(2)));

            totalOverallScore += aggregateScore;
            totalOverallPossibleMarks += totalPossibleForAggregate;

            return {
                subject_name: subject.subject_name,
                first_term_score: subject.term_scores['FIRST'],
                second_term_score: subject.term_scores['SECOND'],
                third_term_score: subject.term_scores['THIRD'],
                aggregate_score: aggregateScore,
                total_marks_possible: totalPossibleForAggregate,
                average_score_percentage: parseFloat(percentage.toFixed(2)),
                grade,
                remark,
                exams: subject.exams
            };
        });

        const overallPercentage = totalOverallPossibleMarks > 0 ? (totalOverallScore / totalOverallPossibleMarks) * 100 : 0;
        const { grade: overallGrade, remark: overallRemark } = getGradeAndRemark(parseFloat(overallPercentage.toFixed(2)));

        // 3. Calculate Class Position
        let classPosition = 'N/A';
        if (student.class_level_id) {
            // Fetch all students in the same class level for the current session and term
            const classResultsQuery = await client.query(
                `SELECT
                    er.student_id,
                    SUM(er.raw_score_obtained) as total_raw_score,
                    SUM(er.total_possible_marks) as total_possible_marks
                 FROM exam_results er
                 JOIN exams e ON er.exam_id = e.exam_id
                 JOIN users u ON er.student_id = u.id
                 WHERE u.class_level_id = $1 AND e.session = $2 AND e.term = $3
                 GROUP BY er.student_id`,
                [student.class_level_id, session, term.toUpperCase()]
            );

            const studentScores = classResultsQuery.rows.map(row => ({
                student_id: row.student_id,
                overall_percentage: row.total_possible_marks > 0 ? (Number(row.total_raw_score) / Number(row.total_possible_marks)) * 100 : 0
            }));

            // Sort students by overall percentage in descending order
            studentScores.sort((a, b) => b.overall_percentage - a.overall_percentage);

            let rank = 1;
            let previousScore = -1; // Assuming scores are non-negative
            for (let i = 0; i < studentScores.length; i++) {
                if (studentScores[i].overall_percentage !== previousScore) {
                    rank = i + 1; // New rank for a new score
                }
                if (studentScores[i].student_id === parseInt(studentId)) {
                    classPosition = `${rank} of ${studentScores.length}`;
                    break;
                }
                previousScore = studentScores[i].overall_percentage;
            }
        }


        // 4. Fetch Report Card Metadata (teacher comments, next term begins, assessments, teacher name)
        const metaQuery = await client.query(
            `SELECT
                rcm.teacher_comment, rcm.principal_comment, rcm.next_term_begins,
                rcm.teacher_signature_url, rcm.principal_signature_url,
                rcm.psychomotor_assessment, rcm.affective_domain, rcm.other_assessments,
                rcm.class_position,
                u.full_name AS class_teacher_name, -- Fetch teacher's full name
                rcm.class_teacher_id -- Pass teacher ID back
             FROM report_card_meta rcm
             LEFT JOIN users u ON rcm.class_teacher_id = u.id
             WHERE rcm.student_id = $1 AND rcm.term = $2 AND rcm.session = $3`,
            [studentId, term.toUpperCase(), session]
        );
        const metadata = metaQuery.rows[0] || {};

        client.release();

        res.json({
            student_info: {
                id: student.id,
                full_name: student.full_name || student.username,
                admission_number: student.admission_number,
                profile_picture_url: student.profile_picture_url,
                class_level_name: student.class_level_name,
                dob: student.dob ? new Date(student.dob).toISOString().split('T')[0] : 'N/A',
                gender: student.gender || 'N/A',
                department: student.department || null
            },
            term: term.toUpperCase(),
            session: session,
            results_by_subject: aggregatedResults,
            overall_performance: {
                total_subjects_taken: totalSubjectsTaken,
                total_score_obtained: totalOverallScore,
                total_possible_marks: totalOverallPossibleMarks,
                overall_percentage: parseFloat(overallPercentage.toFixed(2)),
                overall_grade: overallGrade,
                overall_remark: overallRemark,
                class_position: metadata.class_position || classPosition // Use calculated position if not in meta, otherwise use meta
            },
            teacher_comment: metadata.teacher_comment || 'No comment provided.',
            principal_comment: metadata.principal_comment || 'No comment provided.', // Keep for now as it's in the DB schema
            next_term_begins: metadata.next_term_begins ? new Date(metadata.next_term_begins).toISOString().split('T')[0] : null,
            teacher_signature_url: metadata.teacher_signature_url || null,
            principal_signature_url: metadata.principal_signature_url || null, // Keep for now as it's in the DB schema
            psychomotor_assessment: metadata.psychomotor_assessment || {},
            affective_domain: metadata.affective_domain || {},
            other_assessments: metadata.other_assessments || {},
            class_teacher_name: metadata.class_teacher_name || 'N/A', // Pass teacher name
            class_teacher_id: metadata.class_teacher_id || null // Pass teacher ID
        });

    } catch (error) {
        console.error("Error generating report card:", error);
        res.status(500).json({ error: "Failed to generate report card: " + error.message });
    }
});


module.exports = router;

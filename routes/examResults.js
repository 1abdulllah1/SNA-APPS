// routes/examResults.js
const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const auth = require("../middlewares/auth");

// --- Enhanced Grading and Remark Helper (No changes here) ---
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

// --- COMPLETELY REBUILT: The Report Card Engine ---
// This route compiles report data for display, but does not save the metadata.
// Now accessible by Admin or Teacher roles
router.get("/report/compile", auth, async (req, res) => {
    // Check if user is admin or teacher
    if (!req.user.is_admin && req.user.role !== 'teacher') {
        return res.status(403).json({ error: "Access denied. Admin or Teacher privileges required." });
    }
    
    const { studentId, term, session } = req.query;
    if (!studentId || !term || !session) {
        return res.status(400).json({ error: "Student, term, and session are required." });
    }

    const client = await pool.connect();
    try {
        const studentRes = await client.query("SELECT * FROM users WHERE id = $1 AND role = 'student'", [studentId]);
        if (studentRes.rows.length === 0) throw new Error("Student not found.");
        const student = studentRes.rows[0];
        // Ensure class_id is used for class level if available, otherwise fallback to class_level from users table.
        // It's assumed your 'users' table has 'class_id' for student records.
        const classLevelId = student.class_id; 

        // Fetch the actual class level name using class_id
        let classLevelName = 'Unknown Class';
        if (classLevelId) {
            const classRes = await client.query("SELECT name FROM classes WHERE class_id = $1", [classLevelId]);
            if (classRes.rows.length > 0) {
                classLevelName = classRes.rows[0].name;
            }
        }


        // 1. Get ALL subjects registered for the student's class. This is the definitive list.
        // Subjects are now linked to classes, so we should fetch subjects associated with this class_id.
        // Assuming 'subjects' table has a 'class_id' column for this purpose, or a linking table.
        // For simplicity, let's assume subjects apply generally or based on a common 'level' field
        // if your subjects table has it, otherwise, we fetch all subjects.
        // Adjust this query based on how your subjects are associated with classes/levels.
        // For now, I'll assume subjects might have an associated 'class_level' or are general.
        // If your subjects are truly universal, you'd just select all.
        const subjectsRes = await client.query(`
            SELECT s.name, s.subject_id FROM subjects s
            -- JOIN class_subjects cs ON s.subject_id = cs.subject_id WHERE cs.class_id = $1
            ORDER BY s.name
        `);
        const allClassSubjects = subjectsRes.rows.map(s => ({ name: s.name, subject_id: s.subject_id })); // Store both name and ID
        
        // 2. Fetch ALL results for ALL students in the class for the term/session.
        // Use student's class_id for filtering.
        const allClassResultsRes = await client.query(`
            SELECT r.student_id, s.name AS subject_name, e.exam_type, 
                   r.raw_score_obtained, r.total_possible_marks,
                   e.subject_id -- Added to link results to actual subject_id
            FROM exam_results r
            JOIN exams e ON r.exam_id = e.exam_id
            JOIN users u ON r.student_id = u.id
            JOIN subjects s ON e.subject_id = s.subject_id
            WHERE u.class_id = $1 AND e.term = $2 AND e.session = $3
        `, [classLevelId, term.toUpperCase(), session]);
        
        // 3. Organize results by student and then by subject.
        const studentScores = {};
        allClassResultsRes.rows.forEach(r => {
            if (!studentScores[r.student_id]) studentScores[r.student_id] = {};
            if (!studentScores[r.student_id][r.subject_name]) {
                studentScores[r.student_id][r.subject_name] = { CAs: [], Exam: null };
            }
            const result = { score: r.raw_score_obtained, max: r.total_possible_marks };
            if (r.exam_type.startsWith('CA') || r.exam_type === 'MID_TERM') {
                studentScores[r.student_id][r.subject_name].CAs.push(result);
            } else if (r.exam_type === 'MAIN_EXAM') {
                studentScores[r.student_id][r.subject_name].Exam = result;
            }
        });

        // 4. Calculate total score for EVERY student to determine class position.
        const studentTotals = {};
        Object.keys(studentScores).forEach(sId => {
            studentTotals[sId] = 0; // Initialize total score
            Object.values(studentScores[sId]).forEach(subjectResults => {
                const totalCAScore = subjectResults.CAs.reduce((sum, ca) => sum + (ca.score || 0), 0);
                const totalCAMax = subjectResults.CAs.reduce((sum, ca) => sum + (ca.max || 0), 0);
                const scaledCA = totalCAMax > 0 ? (totalCAScore / totalCAMax) * 40 : 0;
                
                const examScore = subjectResults.Exam?.score || 0;
                const examMax = subjectResults.Exam?.max || 0;
                const scaledExam = examMax > 0 ? (examScore / examMax) * 60 : 0;
                
                studentTotals[sId] += (scaledCA + scaledExam);
            });
        });

        // 5. Rank students
        const rankedStudents = Object.entries(studentTotals).map(([sId, totalScore]) => ({ studentId: sId, totalScore }));
        rankedStudents.sort((a, b) => b.totalScore - a.totalScore);
        const studentRank = rankedStudents.findIndex(s => s.studentId == studentId) + 1;
        
        // 6. Fetch previous term scores for the TARGET student for cumulative calculation
        const prevTerms = [];
        if (term.toUpperCase() === 'SECOND') {
            prevTerms.push('FIRST');
        } else if (term.toUpperCase() === 'THIRD') {
            prevTerms.push('FIRST', 'SECOND');
        }

        const prevResultsRes = prevTerms.length > 0
            ? await client.query("SELECT term, cumulative_data FROM report_card_meta WHERE student_id = $1 AND session = $2 AND term = ANY($3::text[])", [studentId, session, prevTerms])
            : { rows: [] };
        
        const previousTermScores = {};
        prevResultsRes.rows.forEach(row => {
            // Ensure cumulative_data is parsed, and handle potential null/empty
            const termData = row.cumulative_data ? JSON.parse(row.cumulative_data) : [];
            termData.forEach(subject => {
                if (!previousTermScores[subject.subjectName]) previousTermScores[subject.subjectName] = {};
                previousTermScores[subject.subjectName][row.term] = subject.finalScore;
            });
        });
        
        // 7. Generate the detailed report for the TARGET student
        let grandTotalScore = 0;
        let grandTotalMarks = 0; // This will always be 100 * number of subjects for percentage calculation
        const studentSubjectResults = studentScores[studentId] || {};

        const processedSubjects = allClassSubjects.map(subject => {
            const subjectName = subject.name;
            const scores = studentSubjectResults[subjectName] || { CAs: [], Exam: null };
            
            const totalCAScore = scores.CAs.reduce((sum, ca) => sum + (ca.score || 0), 0);
            const totalCAMax = scores.CAs.reduce((sum, ca) => sum + (ca.max || 0), 0);
            const scaledCA = totalCAMax > 0 ? (totalCAScore / totalCAMax) * 40 : 0;

            const examScore = scores.Exam?.score || 0;
            const examMax = scores.Exam?.max || 0;
            const scaledExam = examMax > 0 ? (examScore / examMax) * 60 : 0;
            
            const finalScore = scaledCA + scaledExam;
            grandTotalScore += finalScore;
            grandTotalMarks += 100; // Each subject contributes 100 to total possible marks

            const gradeInfo = getGradeAndRemark(finalScore);
            
            const firstTermScore = term.toUpperCase() === 'FIRST' ? finalScore : (previousTermScores[subjectName]?.FIRST || null);
            const secondTermScore = term.toUpperCase() === 'SECOND' ? finalScore : (previousTermScores[subjectName]?.SECOND || null);
            const thirdTermScore = term.toUpperCase() === 'THIRD' ? finalScore : (previousTermScores[subjectName]?.THIRD || null); // Ensure third term score is picked up from previous if fetching for other terms

            const validCumulativeScores = [firstTermScore, secondTermScore, thirdTermScore].filter(s => s !== null && !isNaN(s)).map(s => parseFloat(s));
            const cumulativeAvg = validCumulativeScores.length > 0 ? (validCumulativeScores.reduce((a, b) => a + b, 0) / validCumulativeScores.length) : finalScore;

            return {
                subjectName: subjectName,
                ca_scaled: scaledCA.toFixed(1),
                exam_scaled: scaledExam.toFixed(1),
                finalScore: finalScore.toFixed(1),
                firstTerm: firstTermScore !== null ? firstTermScore.toFixed(1) : '-',
                secondTerm: secondTermScore !== null ? secondTermScore.toFixed(1) : '-',
                thirdTerm: thirdTermScore !== null ? thirdTermScore.toFixed(1) : '-',
                cumulativeAvg: cumulativeAvg.toFixed(1),
                grade: gradeInfo.grade,
                remark: gradeInfo.remark
            };
        });

        const overallPercentage = grandTotalMarks > 0 ? (grandTotalScore / grandTotalMarks) * 100 : 0;

        // Fetch meta data from the new report_card_meta table
        const metaRes = await client.query("SELECT * FROM report_card_meta WHERE student_id = $1 AND term = $2 AND session = $3", [studentId, term.toUpperCase(), session]);
        
        res.json({
            student,
            term: term.toUpperCase(),
            session,
            classLevel: classLevelName, // Provide the actual class name
            subjects: processedSubjects,
            meta: metaRes.rows.length > 0 ? metaRes.rows[0] : {},
            summary: {
                totalScoreObtained: grandTotalScore.toFixed(1),
                totalPossibleMarks: grandTotalMarks,
                overallPercentage: overallPercentage.toFixed(2),
                position: rankedStudents.length > 0 ? `${studentRank} out of ${rankedStudents.length}` : 'N/A',
            }
        });

    } catch (error) {
        console.error("Report compilation error:", error);
        res.status(500).json({ error: "Failed to compile report card data. " + error.message });
    } finally {
        client.release();
    }
});

/**
 * @route GET /api/exam-results/student/:studentId
 * @description Fetch all exam results for a specific student.
 * @access Authenticated (admin or the student themselves)
 * @param {string} studentId - The ID of the student.
 */
router.get("/student/:studentId", auth, async (req, res) => {
    try {
        const { studentId } = req.params;

        // Ensure the authenticated user is either an admin or the student themselves
        if (req.user.id !== parseInt(studentId) && !req.user.is_admin) {
            return res.status(403).json({ error: "Unauthorized access to student results." });
        }

        const resultsQuery = await pool.query(
            `SELECT
                er.result_id,
                er.exam_id,
                er.student_id,
                er.score,
                er.submission_time, -- Ensure this column exists in your DB or change name
                e.title AS exam_title,
                e.duration_minutes
             FROM exam_results er
             JOIN exams e ON er.exam_id = e.exam_id
             WHERE er.student_id = $1
             ORDER BY er.submission_time DESC`,
            [studentId]
        );

        res.json(resultsQuery.rows);
    } catch (error) {
        console.error("Error fetching student results:", error);
        res.status(500).json({ error: "Failed to fetch student results." });
    }
});

/**
 * @route GET /api/exam-results/exam/:examId
 * @description Fetch all student results for a specific exam (teacher/admin view).
 * @access Authenticated (admin or teacher)
 * @param {string} examId - The ID of the exam.
 */
router.get("/exam/:examId", auth, async (req, res) => {
    try {
        // Ensure the authenticated user is either an admin or a teacher
        if (!req.user.is_admin && req.user.role !== 'teacher') {
            return res.status(403).json({ error: "Unauthorized. Admin or Teacher privileges required." });
        }

        const { examId } = req.params;

        // Fetch exam details
        const examQuery = await pool.query("SELECT title FROM exams WHERE exam_id = $1", [examId]);
        if (examQuery.rows.length === 0) {
            return res.status(404).json({ error: "Exam not found." });
        }
        const examTitle = examQuery.rows[0].title;

        // Fetch all results for this exam, joining with user and class info
        const resultsQuery = await pool.query(
            `SELECT
                er.result_id,
                er.student_id,
                er.score,
                er.submission_time,
                u.full_name,
                u.username,
                u.admission_number,
                c.name AS class_name
             FROM exam_results er
             JOIN users u ON er.student_id = u.id
             LEFT JOIN classes c ON u.class_id = c.class_id
             WHERE er.exam_id = $1
             ORDER BY er.submission_time DESC`,
            [examId]
        );

        res.json({
            exam_title: examTitle,
            results: resultsQuery.rows
        });
    } catch (error) {
        console.error("Error fetching teacher/admin exam results:", error);
        res.status(500).json({ error: "Failed to fetch exam results for teacher view." });
    }
});

/**
 * @route GET /api/exam-results/by-result/:resultId
 * @description Fetch a student's detailed result for a single test.
 * @access Authenticated (admin or the student themselves)
 * @param {string} resultId - The ID of the exam result.
 */
router.get("/by-result/:resultId", auth, async (req, res) => {
    try {
        const { resultId } = req.params;
        const resultQuery = await pool.query("SELECT * FROM exam_results WHERE result_id = $1", [resultId]);
        if (resultQuery.rows.length === 0) return res.status(404).json({ error: "Result not found." });
        const result = resultQuery.rows[0];
        if (result.student_id !== req.user.id && !req.user.is_admin) {
             return res.status(403).json({ error: "Unauthorized." });
        }
        const examQuery = await pool.query("SELECT * FROM exams WHERE exam_id = $1", [result.exam_id]);
        const questionsQuery = await pool.query(`SELECT * FROM questions WHERE exam_id = $1`, [result.exam_id]);
        res.json({ exam: { ...examQuery.rows[0], ...result }, questions: questionsQuery.rows, viewMode: 'student' });
    } catch (error) {
        console.error("Fetch by-result-id error:", error);
        res.status(500).json({ error: "Failed to fetch detailed result." });
    }
});


module.exports = router;

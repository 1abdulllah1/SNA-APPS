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
router.get("/report/compile", auth, async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: "Access denied." });
    
    const { studentId, term, session } = req.query;
    if (!studentId || !term || !session) {
        return res.status(400).json({ error: "Student, term, and session are required." });
    }

    const client = await pool.connect();
    try {
        const studentRes = await client.query("SELECT * FROM users WHERE id = $1 AND role = 'student'", [studentId]);
        if (studentRes.rows.length === 0) throw new Error("Student not found.");
        const student = studentRes.rows[0];
        const classLevel = student.class_level;

        // 1. Get ALL subjects registered for the student's class. This is the definitive list.
        const subjectsRes = await client.query("SELECT name FROM subjects WHERE class_level = $1 OR class_level IS NULL ORDER BY name", [classLevel]);
        const allClassSubjects = subjectsRes.rows.map(s => s.name);
        
        // 2. Fetch ALL results for ALL students in the class for the term/session.
        const allClassResultsRes = await client.query(`
            SELECT r.student_id, s.name AS subject_name, e.exam_type, 
                   r.raw_score_obtained, r.total_possible_marks
            FROM exam_results r
            JOIN exams e ON r.exam_id = e.exam_id
            JOIN users u ON r.student_id = u.id
            JOIN subjects s ON e.subject_id = s.subject_id
            WHERE u.class_level = $1 AND e.term = $2 AND e.session = $3
        `, [classLevel, term.toUpperCase(), session]);
        
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
                // **FIX**: Ensure `score` and `max` are numbers, defaulting to 0 if null/undefined.
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
        const prevTerms = term.toUpperCase() === 'SECOND' ? ['FIRST'] : term.toUpperCase() === 'THIRD' ? ['FIRST', 'SECOND'] : [];
        const prevResultsRes = prevTerms.length > 0
            ? await client.query("SELECT term, cumulative_data FROM report_card_meta WHERE student_id = $1 AND session = $2 AND term = ANY($3::text[])", [studentId, session, prevTerms])
            : { rows: [] };
        
        const previousTermScores = {};
        prevResultsRes.rows.forEach(row => {
            const termData = JSON.parse(row.cumulative_data || '[]');
            termData.forEach(subject => {
                if (!previousTermScores[subject.subjectName]) previousTermScores[subject.subjectName] = {};
                previousTermScores[subject.subjectName][row.term] = subject.finalScore;
            });
        });
        
        // 7. Generate the detailed report for the TARGET student
        let grandTotalScore = 0;
        let grandTotalMarks = 0;
        const studentSubjectResults = studentScores[studentId] || {};

        const processedSubjects = allClassSubjects.map(subjectName => {
            const scores = studentSubjectResults[subjectName] || { CAs: [], Exam: null };
            
            // **FIX**: This block is now safe from NaN errors.
            const totalCAScore = scores.CAs.reduce((sum, ca) => sum + (ca.score || 0), 0);
            const totalCAMax = scores.CAs.reduce((sum, ca) => sum + (ca.max || 0), 0);
            const scaledCA = totalCAMax > 0 ? (totalCAScore / totalCAMax) * 40 : 0;

            const examScore = scores.Exam?.score || 0;
            const examMax = scores.Exam?.max || 0;
            const scaledExam = examMax > 0 ? (examScore / examMax) * 60 : 0;
            
            const finalScore = scaledCA + scaledExam;
            grandTotalScore += finalScore;
            grandTotalMarks += 100;

            const gradeInfo = getGradeAndRemark(finalScore);
            const firstTermScore = term.toUpperCase() === 'FIRST' ? finalScore : (previousTermScores[subjectName]?.FIRST || null);
            const secondTermScore = term.toUpperCase() === 'SECOND' ? finalScore : (previousTermScores[subjectName]?.SECOND || null);
            
            const validCumulativeScores = [firstTermScore, secondTermScore].filter(s => s !== null).map(s => parseFloat(s));
            const cumulativeAvg = validCumulativeScores.length > 0 ? (validCumulativeScores.reduce((a, b) => a + b, 0) / validCumulativeScores.length) : finalScore;

            return {
                subjectName: subjectName,
                ca_scaled: scaledCA.toFixed(1),
                exam_scaled: scaledExam.toFixed(1),
                finalScore: finalScore.toFixed(1),
                firstTerm: firstTermScore?.toFixed(1) || '-',
                secondTerm: secondTermScore?.toFixed(1) || '-',
                thirdTerm: term.toUpperCase() === 'THIRD' ? finalScore.toFixed(1) : '-',
                cumulativeAvg: cumulativeAvg.toFixed(1),
                grade: gradeInfo.grade,
                remark: gradeInfo.remark
            };
        });

        const overallPercentage = grandTotalMarks > 0 ? (grandTotalScore / grandTotalMarks) * 100 : 0;

        const metaRes = await client.query("SELECT * FROM report_card_meta WHERE student_id = $1 AND term = $2 AND session = $3", [studentId, term.toUpperCase(), session]);
        
        res.json({
            student, term: term.toUpperCase(), session, subjects: processedSubjects, meta: metaRes.rows[0] || {},
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


// --- Route to save report meta (no changes needed here) ---
router.post("/report/meta", auth, async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: "Access denied." });
    const { studentId, term, session, teacherComment, principalComment, nextTermBegins, cumulativeData, classLevel } = req.body;
    if (!studentId || !term || !session || !classLevel) {
        return res.status(400).json({ error: "Missing required identifiers." });
    }
    try {
        const query = `
            INSERT INTO report_card_meta (student_id, term, session, class_level, teacher_comment, principal_comment, next_term_begins, cumulative_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (student_id, term, session) 
            DO UPDATE SET
                class_level = EXCLUDED.class_level,
                teacher_comment = EXCLUDED.teacher_comment,
                principal_comment = EXCLUDED.principal_comment,
                next_term_begins = EXCLUDED.next_term_begins,
                cumulative_data = EXCLUDED.cumulative_data,
                updated_at = NOW();
        `;
        await pool.query(query, [studentId, term, session, classLevel, teacherComment, principalComment, nextTermBegins || null, cumulativeData]);
        res.status(200).json({ message: "Report card data saved successfully." });
    } catch (error) {
        console.error("Error saving report meta:", error);
        res.status(500).json({ error: "Failed to save report card data." });
    }
});


// --- Route to get a student's result for a single test (no changes needed here) ---
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
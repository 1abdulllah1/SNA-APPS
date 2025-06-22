const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const auth = require("../middlewares/auth");

// --- NEW: Enhanced Grading and Remark Helper ---
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


// --- OVERHAULED: The Report Card Engine ---
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

        // 1. Fetch ALL results for ALL students in the class for the term/session to calculate position
        const allClassResultsRes = await client.query(`
            SELECT r.student_id, u.first_name, u.last_name, s.name AS subject_name, e.exam_type, 
                   r.raw_score_obtained, r.total_possible_marks
            FROM exam_results r
            JOIN exams e ON r.exam_id = e.exam_id
            JOIN users u ON r.student_id = u.id
            JOIN subjects s ON e.subject_id = s.subject_id
            WHERE u.class_level = $1 AND e.term = $2 AND e.session = $3
        `, [classLevel, term.toUpperCase(), session]);

        // 2. Fetch previous term scores for CUMULATIVE average calculation
        const prevTerms = term.toUpperCase() === 'SECOND' ? ['FIRST'] : term.toUpperCase() === 'THIRD' ? ['FIRST', 'SECOND'] : [];
        const prevResultsRes = prevTerms.length > 0
            ? await client.query("SELECT student_id, term, cumulative_data FROM report_card_meta WHERE class_level = $1 AND session = $2 AND term = ANY($3::text[])", [classLevel, session, prevTerms])
            : { rows: [] };
        
        // 3. Process scores for EVERY student to determine rank
        const studentTotals = {};
        allClassResultsRes.rows.forEach(r => {
            if (!studentTotals[r.student_id]) studentTotals[r.student_id] = { totalScore: 0, subjects: {} };
            if (!studentTotals[r.student_id].subjects[r.subject_name]) {
                studentTotals[r.student_id].subjects[r.subject_name] = { CAs: [], Exam: null };
            }

            const result = { score: r.raw_score_obtained || 0, max: r.total_possible_marks || 0 };
            if (r.exam_type.startsWith('CA') || r.exam_type === 'MID_TERM') {
                studentTotals[r.student_id].subjects[r.subject_name].CAs.push(result);
            } else if (r.exam_type === 'MAIN_EXAM') {
                studentTotals[r.student_id].subjects[r.subject_name].Exam = result;
            }
        });

        // Calculate final score for each student
        Object.keys(studentTotals).forEach(sId => {
            let grandTotal = 0;
            Object.values(studentTotals[sId].subjects).forEach(subject => {
                const totalCAScore = subject.CAs.reduce((sum, ca) => sum + ca.score, 0);
                const totalCAMax = subject.CAs.reduce((sum, ca) => sum + ca.max, 0);
                const scaledCA = totalCAMax > 0 ? (totalCAScore / totalCAMax) * 40 : 0;

                const examScore = subject.Exam?.score || 0;
                const examMax = subject.Exam?.max || 0;
                const scaledExam = examMax > 0 ? (examScore / examMax) * 60 : 0;
                
                grandTotal += (scaledCA + scaledExam);
            });
            studentTotals[sId].totalScore = grandTotal;
        });

        // 4. Rank students
        const rankedStudents = Object.entries(studentTotals).map(([sId, data]) => ({ studentId: sId, totalScore: data.totalScore }));
        rankedStudents.sort((a, b) => b.totalScore - a.totalScore);
        const studentRank = rankedStudents.findIndex(s => s.studentId === studentId) + 1;

        // 5. Deep dive for the SELECTED student's report card
        const targetStudentResults = studentTotals[studentId];
        if (!targetStudentResults) {
             throw new Error("No results found for this student for the selected term and session.");
        }
        
        const previousTermScores = {};
        prevResultsRes.rows.filter(r => r.student_id == studentId).forEach(row => {
            const termData = (typeof row.cumulative_data === 'string') ? JSON.parse(row.cumulative_data) : row.cumulative_data;
            if (termData) {
                termData.forEach(subject => {
                    if (!previousTermScores[subject.subjectName]) previousTermScores[subject.subjectName] = {};
                    previousTermScores[subject.subjectName][row.term] = subject.finalScore;
                });
            }
        });
        
        let grandTotalScore = 0;
        let grandTotalMarks = 0;

        const processedSubjects = Object.entries(targetStudentResults.subjects).map(([name, scores]) => {
            const totalCAScore = scores.CAs.reduce((sum, ca) => sum + ca.score, 0);
            const totalCAMax = scores.CAs.reduce((sum, ca) => sum + ca.max, 0);
            const scaledCA = totalCAMax > 0 ? (totalCAScore / totalCAMax) * 40 : 0;

            const examScore = scores.Exam?.score || 0;
            const examMax = scores.Exam?.max || 0;
            const scaledExam = examMax > 0 ? (examScore / examMax) * 60 : 0;
            
            const finalScore = scaledCA + scaledExam;
            grandTotalScore += finalScore;
            grandTotalMarks += 100;

            const gradeInfo = getGradeAndRemark(finalScore);
            
            const currentTermUpper = term.toUpperCase();
            const firstTermScore = currentTermUpper === 'FIRST' ? finalScore : (previousTermScores[name]?.FIRST || null);
            const secondTermScore = currentTermUpper === 'SECOND' ? finalScore : (previousTermScores[name]?.SECOND || null);
            const thirdTermScore = currentTermUpper === 'THIRD' ? finalScore : null;
            
            const validScores = [firstTermScore, secondTermScore, thirdTermScore].filter(s => s !== null).map(s => parseFloat(s));
            const cumulativeAvg = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;

            return { subjectName: name, ca_scaled: scaledCA.toFixed(1), exam_scaled: scaledExam.toFixed(1), finalScore: finalScore.toFixed(1),
                firstTerm: firstTermScore?.toFixed(1) || '-', secondTerm: secondTermScore?.toFixed(1) || '-', thirdTerm: thirdTermScore?.toFixed(1) || '-',
                cumulativeAvg: cumulativeAvg?.toFixed(1) || '-', grade: gradeInfo.grade, remark: gradeInfo.remark
            };
        });

        const overallPercentage = grandTotalMarks > 0 ? (grandTotalScore / grandTotalMarks) * 100 : 0;

        // 6. Fetch report metadata (comments, etc.)
        const metaRes = await client.query("SELECT * FROM report_card_meta WHERE student_id = $1 AND term = $2 AND session = $3", [studentId, term.toUpperCase(), session]);
        
        res.json({
            student, term: term.toUpperCase(), session, subjects: processedSubjects, meta: metaRes.rows[0] || {},
            summary: {
                totalScoreObtained: grandTotalScore.toFixed(1),
                totalPossibleMarks: grandTotalMarks,
                overallPercentage: overallPercentage.toFixed(2),
                position: `${studentRank} out of ${rankedStudents.length}`,
            }
        });
    } catch (error) {
        console.error("Report compilation error:", error);
        res.status(500).json({ error: "Failed to compile report card data. " + error.message });
    } finally {
        client.release();
    }
});


// --- NEW: Route to save report meta, now includes class_level for better querying ---
router.post("/report/meta", auth, async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: "Access denied." });
    
    const { studentId, term, session, teacherComment, principalComment, nextTermBegins, cumulativeData, classLevel } = req.body;

    if (!studentId || !term || !session || !classLevel) {
        return res.status(400).json({ error: "Missing required identifiers (studentId, term, session, classLevel)." });
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


// This route gets a student's detailed result for a single test (unchanged)
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
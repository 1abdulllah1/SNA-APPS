const pool = require("../database/db");

// This function is called from the /:examId/start route
exports.startExamSession = async (userId, examId) => {
  try {
    // First, get the exam details to check its status and get questions
    const examResult = await pool.query(
      `SELECT e.*, s.name as subject_name 
       FROM exams e
       LEFT JOIN subjects s ON e.subject_id = s.subject_id
       WHERE e.exam_id = $1`,
      [examId]
    );
    if (examResult.rows.length === 0) {
        throw new Error("Exam not found or is not currently active.");
    }
    const exam = examResult.rows[0];

    // Check if the exam is locked
    if (exam.is_locked) {
        throw new Error("This exam is currently locked by the administrator.");
    }

    // Check if the user has already submitted this exam
    const previousSubmission = await pool.query(
      "SELECT result_id FROM exam_results WHERE student_id = $1 AND exam_id = $2",
      [userId, examId]
    );
    if (previousSubmission.rows.length > 0) {
      throw new Error("You have already completed and submitted this exam.");
    }

    const questionsResult = await pool.query(
      `SELECT question_id, question_text, option_a, option_b, option_c, option_d, marks 
       FROM questions WHERE exam_id = $1 ORDER BY RANDOM()`,
      [examId]
    );
    
    if (questionsResult.rows.length === 0) {
      console.error(`CRITICAL: No questions found for exam ID: ${examId} during session start.`);
      throw new Error("This exam has no questions available.");
    }

    // Transform question data for the frontend
    const transformedQuestions = questionsResult.rows.map(q => ({
        question_id: q.question_id,
        question_text: q.question_text,
        options: [
            { option_id: 'a', option_text: q.option_a },
            { option_id: 'b', option_text: q.option_b },
            { option_id: 'c', option_text: q.option_c },
            { option_id: 'd', option_text: q.option_d }
        ],
        marks: q.marks
    }));

    // Create a new session record
    await pool.query(
        `INSERT INTO exam_sessions (user_id, exam_id, start_time)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, exam_id) DO NOTHING`,
        [userId, examId]
    );

    return { exam: exam, questions: transformedQuestions };
  } catch (error) {
    console.error("Exam start service error:", error);
    throw error;
  }
};


// This function is called from the /:examId/submit route
exports.submitExam = async (userId, examId, answers, timeTakenSeconds) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const totalMarksResult = await client.query(
      "SELECT SUM(marks) as total_marks FROM questions WHERE exam_id = $1",
      [examId]
    );
    const totalPossibleMarks = parseInt(totalMarksResult.rows[0].total_marks || 0);

    const questionsResult = await client.query(
      "SELECT question_id, correct_answer, marks FROM questions WHERE exam_id = $1",
      [examId]
    );
    const questions = questionsResult.rows;
    if (questions.length === 0) throw new Error("Cannot submit result for an exam with no questions.");

    let rawScoreObtained = 0;
    questions.forEach(q => {
      const studentAnswer = answers[q.question_id];
      if (studentAnswer && studentAnswer.toUpperCase() === q.correct_answer.toUpperCase()) {
        rawScoreObtained += q.marks;
      }
    });

    const percentageScore = totalPossibleMarks > 0 ? (rawScoreObtained / totalPossibleMarks) * 100 : 0;
    const finalScore = Math.round(percentageScore);

    // Check if the table has the required columns
    const columnCheck = await client.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'exam_results'
         AND column_name IN ('total_possible_marks', 'raw_score_obtained', 'time_taken_seconds')`
    );

    const hasColumns = {
      total_possible_marks: columnCheck.rows.some(r => r.column_name === 'total_possible_marks'),
      raw_score_obtained: columnCheck.rows.some(r => r.column_name === 'raw_score_obtained'),
      time_taken_seconds: columnCheck.rows.some(r => r.column_name === 'time_taken_seconds'),
    };

    // Prepare query based on existing columns
    let columns = ['student_id', 'exam_id', 'score', 'answers'];
    let values = [userId, examId, finalScore, answers];
    let placeholders = values.map((_, i) => `$${i+1}`);
    let updateSet = ['score = EXCLUDED.score', 'answers = EXCLUDED.answers'];

    // Add submission_date to both insert and update
    columns.push('submission_date');
    placeholders.push('NOW()');
    updateSet.push('submission_date = NOW()');
    
    if (hasColumns.raw_score_obtained) {
      columns.push('raw_score_obtained');
      values.push(rawScoreObtained);
      placeholders.push(`$${values.length}`);
      updateSet.push('raw_score_obtained = EXCLUDED.raw_score_obtained');
    }
    
    if (hasColumns.total_possible_marks) {
      columns.push('total_possible_marks');
      values.push(totalPossibleMarks);
      placeholders.push(`$${values.length}`);
      updateSet.push('total_possible_marks = EXCLUDED.total_possible_marks');
    }
    
    if (hasColumns.time_taken_seconds) {
      columns.push('time_taken_seconds');
      values.push(timeTakenSeconds);
      placeholders.push(`$${values.length}`);
      updateSet.push('time_taken_seconds = EXCLUDED.time_taken_seconds');
    }

    const query = `
      INSERT INTO exam_results (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (student_id, exam_id) DO UPDATE
      SET ${updateSet.join(', ')}
      RETURNING result_id;
    `;

    const result = await client.query(query, values);
    const newResultId = result.rows[0]?.result_id;

    await client.query(
      `UPDATE exam_sessions SET end_time = NOW()
       WHERE user_id = $1 AND exam_id = $2 AND end_time IS NULL`,
      [userId, examId]
    );

    await client.query('COMMIT');

    return {
      resultId: newResultId,
      score: percentageScore,
      rawScoreObtained: rawScoreObtained,
      totalPossibleMarks: hasColumns.total_possible_marks ? totalPossibleMarks : null,
      message: "Exam submitted successfully."
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Exam submission service error:", error);
    
    // Enhanced error handling
    if (error.code === '42703') {
      const missingColumn = error.message.match(/column "([^"]+)"/i)?.[1] || 'unknown column';
      throw new Error(`Database schema error: Missing column '${missingColumn}'. Contact administrator.`);
    }
    
    throw new Error("Failed to submit exam: " + error.message);
  } finally {
    client.release();
  }
};
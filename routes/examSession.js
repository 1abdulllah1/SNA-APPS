const express = require("express");
const router = express.Router();
const { startExamSession, submitExam, saveExamProgress } = require("../services/examServices"); // Ensure saveExamProgress is imported
const auth = require("../middlewares/auth");


router.post("/:examId/start", auth, async (req, res) => {
  try {
    const { examId } = req.params;
    if (isNaN(parseInt(examId))) {
        return res.status(400).json({ error: "Invalid Exam ID format." });
    }
    const result = await startExamSession(req.user.id, parseInt(examId));
    res.json(result);
  } catch (error) {
    console.error("Error in POST /:examId/start route:", error);
    // Ensure consistent JSON error response
    res.status(500).json({ error: error.message || "Failed to start exam session." });
  }
});

// **NEW**: Save Exam Progress
router.post("/:examId/progress", auth, async (req, res) => {
    try {
        const { examId } = req.params;
        const { answers, timeRemaining } = req.body;
        // Validate incoming data
        if (isNaN(parseInt(examId))) {
            return res.status(400).json({ error: "Invalid Exam ID format." });
        }
        if (answers === undefined || timeRemaining === undefined) {
            return res.status(400).json({ error: "Missing answers or timeRemaining for progress save." });
        }

        const result = await saveExamProgress(req.user.id, parseInt(examId), answers, timeRemaining);
        res.json(result);
    } catch (error) {
        console.error("Error in POST /:examId/progress route:", error);
        // Ensure consistent JSON error response
        res.status(500).json({ error: error.message || "Failed to save progress." });
    }
});


router.post("/:examId/submit", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { examId } = req.params;
    const { answers, timeTakenSeconds } = req.body;

    if (isNaN(parseInt(examId))) {
        return res.status(400).json({ error: "Invalid Exam ID format." });
    }
    if (!answers || Object.keys(answers).length === 0) {
        return res.status(400).json({ error: "No answers provided for submission." });
    }
    // Check if timeTakenSeconds is a valid number, allow 0
    if (timeTakenSeconds === undefined || typeof timeTakenSeconds !== 'number' || timeTakenSeconds < 0) {
        return res.status(400).json({ error: "Invalid time taken provided." });
    }

    const submissionResult = await submitExam(userId, parseInt(examId), answers, timeTakenSeconds);
    res.json(submissionResult);
  } catch (error) {
    console.error("Error in POST /:examId/submit route:", error);
    res.status(500).json({ error: error.message || "Failed to submit exam." });
  }
});


module.exports = router;

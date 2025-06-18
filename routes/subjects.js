const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const auth = require('../middlewares/auth');

// Middleware to ensure only admins can access these routes
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
  next();
};

// GET /api/subjects - Fetch all subjects
router.get('/', auth, async (req, res) => {
  try {
    const subjects = await pool.query("SELECT * FROM subjects ORDER BY name ASC");
    res.json(subjects.rows);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Failed to fetch subjects." });
  }
});

// POST /api/subjects - Create a new subject
router.post('/', auth, isAdmin, async (req, res) => {
  const { name, subject_code } = req.body;
  if (!name || !subject_code) {
    return res.status(400).json({ error: "Subject name and code are required." });
  }
  try {
    const newSubject = await pool.query(
      "INSERT INTO subjects (name, subject_code) VALUES ($1, $2) RETURNING *",
      [name, subject_code.toUpperCase()]
    );
    res.status(201).json(newSubject.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: `A subject with this name or code already exists.` });
    }
    console.error("Error creating subject:", error);
    res.status(500).json({ error: "Failed to create subject." });
  }
});

// PUT /api/subjects/:id - Update an existing subject
router.put('/:id', auth, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, subject_code } = req.body;
  if (!name || !subject_code) {
    return res.status(400).json({ error: "Subject name and code are required." });
  }
  try {
    const updatedSubject = await pool.query(
      "UPDATE subjects SET name = $1, subject_code = $2 WHERE subject_id = $3 RETURNING *",
      [name, subject_code.toUpperCase(), id]
    );
    if (updatedSubject.rows.length === 0) {
      return res.status(404).json({ error: "Subject not found." });
    }
    res.json(updatedSubject.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
        return res.status(409).json({ error: `A subject with this name or code already exists.` });
    }
    console.error(`Error updating subject ${id}:`, error);
    res.status(500).json({ error: "Failed to update subject." });
  }
});

// DELETE /api/subjects/:id - Delete a subject
router.delete('/:id', auth, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // **Professional Check**: Prevent deletion if the subject is in use by an exam.
    const usageCheck = await pool.query("SELECT 1 FROM exams WHERE subject_id = $1 LIMIT 1", [id]);
    if (usageCheck.rows.length > 0) {
      return res.status(400).json({ error: "Cannot delete subject. It is currently assigned to one or more exams. Please reassign those exams first." });
    }

    const deleteResult = await pool.query("DELETE FROM subjects WHERE subject_id = $1", [id]);
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Subject not found." });
    }
    res.status(200).json({ message: "Subject deleted successfully." });
  } catch (error) {
    console.error(`Error deleting subject ${id}:`, error);
    res.status(500).json({ error: "Failed to delete subject." });
  }
});


module.exports = router;
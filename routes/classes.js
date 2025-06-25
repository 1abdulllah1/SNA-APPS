// routes/classes.js
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

/**
 * @route GET /api/classes
 * @description Fetch all classes from the database.
 * @access Authenticated (any authenticated user can view classes)
 */
// REVERTED: Changed from isAdmin back to auth for broader access (teachers, students might need class list)
// FIXED: Changed ORDER BY clause to use 'name' column which exists in 'classes' table
router.get('/', auth, async (req, res) => {
  try {
    const classes = await pool.query("SELECT * FROM classes ORDER BY class_name ASC");
    res.json(classes.rows);
  } catch (error) {
    console.error("Error fetching classes:", error);
    res.status(500).json({ error: "Failed to fetch classes." });
  }
});

/**
 * @route POST /api/classes
 * @description Create a new class. Admin only.
 * @access Admin
 * @body {string} name - The name of the class (e.g., "JSS 1").
 * @body {string} class_code - A unique code for the class (e.g., "JSS1").
 */
router.post('/', auth, isAdmin, async (req, res) => {
  const { name, class_code } = req.body;
  if (!name || !class_code) {
    return res.status(400).json({ error: "Class name and code are required." });
  }

  try {
    const newClass = await pool.query(
      "INSERT INTO classes (class_name, class_code) VALUES ($1, $2) RETURNING *",
      [name, class_code.toUpperCase()]
    );
    res.status(201).json(newClass.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: `A class with this name or code already exists.` });
    }
    console.error("Error creating class:", error);
    res.status(500).json({ error: "Failed to create class." });
  }
});

/**
 * @route DELETE /api/classes/:id
 * @description Delete a class. Admin only.
 * @access Admin
 * @param {string} id - The class_id of the class to delete.
 */
router.delete('/:id', auth, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Professional Check: Prevent deletion if the class is in use by any student.
    const usageCheck = await pool.query("SELECT 1 FROM users WHERE class_id = $1 LIMIT 1", [id]);
    if (usageCheck.rows.length > 0) {
      return res.status(400).json({ error: "Cannot delete class. It is currently assigned to one or more students. Please reassign those students first." });
    }

    const deleteResult = await pool.query("DELETE FROM classes WHERE class_id = $1", [id]);
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Class not found." });
    }
    res.status(200).json({ message: "Class deleted successfully." });
  } catch (error) {
    console.error(`Error deleting class ${id}:`, error);
    res.status(500).json({ error: "Failed to delete class." });
  }
});


module.exports = router;

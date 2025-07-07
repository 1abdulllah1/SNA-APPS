// routes/class-levels.js
// This file defines the API routes for managing class levels in the CBT system.
// It includes operations for fetching, creating, updating, and deleting class levels.

const express = require('express');
const router = express.Router();
const pool = require('../database/db'); // Your PostgreSQL database connection pool
const auth = require('../middlewares/auth'); // Authentication middleware to verify JWT

// The 'auth' middleware object already contains 'isAdmin' and 'isStudent' methods.
// We will use auth.isAdmin directly on the routes that require admin privileges.

/**
 * @route GET /api/class-levels
 * @description Fetch all class levels from the database.
 * @access Authenticated (any authenticated user can view class levels, but only admins can manage them)
 */
router.get('/', auth, async (req, res) => {
  try {
    const classLevels = await pool.query("SELECT * FROM class_levels ORDER BY level_name ASC");
    res.json(classLevels.rows);
  } catch (error) {
    console.error("Error fetching class levels:", error);
    res.status(500).json({ error: "Failed to fetch class levels." });
  }
});

/**
 * @route GET /api/class-levels/:id
 * @description Fetch a single class level by its ID.
 * @access Admin
 * @param {string} id - The level_id of the class level to fetch.
 */
router.get('/:id', auth, auth.isAdmin, async (req, res) => { // Use auth.isAdmin directly
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM class_levels WHERE level_id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Class level not found." });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching class level ${id}:`, error);
    res.status(500).json({ error: "Failed to fetch class level." });
  }
});

/**
 * @route POST /api/class-levels
 * @description Create a new class level. Admin only.
 * @access Admin
 * @body {string} level_name - The name of the class level (e.g., "JSS1")
 * @body {string} level_code - The code for the class level (e.g., "JSS1")
 */
router.post('/', auth, auth.isAdmin, async (req, res) => { // Use auth.isAdmin directly
  const { level_name, level_code } = req.body;
  if (!level_name || !level_code) {
    return res.status(400).json({ error: "Class level name and code are required." });
  }
  try {
    const newClassLevel = await pool.query(
      "INSERT INTO class_levels (level_name, level_code) VALUES ($1, $2) RETURNING *",
      [level_name, level_code.toUpperCase()] // Store code in uppercase for consistency
    );
    res.status(201).json(newClassLevel.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation (e.g., duplicate level_name or level_code)
      return res.status(409).json({ error: `A class level with this name or code already exists.` });
    }
    console.error("Error creating class level:", error);
    res.status(500).json({ error: "Failed to create class level." });
  }
});

/**
 * @route PUT /api/class-levels/:id
 * @description Update an existing class level. Admin only.
 * @access Admin
 * @param {string} id - The level_id of the class level to update.
 * @body {string} level_name - The new name of the class level.
 * @body {string} level_code - The new code for the class level.
 */
router.put('/:id', auth, auth.isAdmin, async (req, res) => { // Use auth.isAdmin directly
  const { id } = req.params;
  const { level_name, level_code } = req.body;
  if (!level_name || !level_code) {
    return res.status(400).json({ error: "Class level name and code are required for update." });
  }
  try {
    // FIX: Removed 'updated_at = NOW()' as the column does not exist in the schema.
    const updatedClassLevel = await pool.query(
      "UPDATE class_levels SET level_name = $1, level_code = $2 WHERE level_id = $3 RETURNING *",
      [level_name, level_code.toUpperCase(), id]
    );
    if (updatedClassLevel.rows.length === 0) {
      return res.status(404).json({ error: "Class level not found." });
    }
    res.json(updatedClassLevel.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: `A class level with this name or code already exists.` });
    }
    console.error(`Error updating class level ${id}:`, error);
    res.status(500).json({ error: "Failed to update class level." });
  }
});

/**
 * @route DELETE /api/class-levels/:id
 * @description Delete a class level. Admin only.
 * @access Admin
 * @param {string} id - The level_id of the class level to delete.
 */
router.delete('/:id', auth, auth.isAdmin, async (req, res) => { // Use auth.isAdmin directly
  const { id } = req.params;
  try {
    // Professional Check: Prevent deletion if the class level is in use by any student.
    const studentUsageCheck = await pool.query("SELECT 1 FROM users WHERE class_level_id = $1 LIMIT 1", [id]);
    if (studentUsageCheck.rows.length > 0) {
      return res.status(400).json({ error: "Cannot delete class level. It is currently assigned to one or more students. Please reassign those students first." });
    }

    // Professional Check: Prevent deletion if the class level is in use by any subject.
    const subjectUsageCheck = await pool.query("SELECT 1 FROM subjects WHERE class_level_id = $1 LIMIT 1", [id]);
    if (subjectUsageCheck.rows.length > 0) {
      return res.status(400).json({ error: "Cannot delete class level. It has subjects assigned to it. Please reassign or delete those subjects first." });
    }

    // Professional Check: Prevent deletion if the class level is in use by any exam.
    const examUsageCheck = await pool.query("SELECT 1 FROM exams WHERE class_level_id = $1 LIMIT 1", [id]);
    if (examUsageCheck.rows.length > 0) {
      return res.status(400).json({ error: "Cannot delete class level. It is associated with one or more exams. Please reassign or delete those exams first." });
    }

    // Professional Check: Prevent deletion if the class level is in use by any specific 'classes' (e.g., "JSS1 Alpha")
    const classUsageCheck = await pool.query("SELECT 1 FROM classes WHERE level = $1 LIMIT 1", [id]);
    if (classUsageCheck.rows.length > 0) {
        return res.status(400).json({ error: "Cannot delete class level. It is associated with one or more specific classes. Please reassign or delete those classes first." });
    }

    const deleteResult = await pool.query("DELETE FROM class_levels WHERE level_id = $1", [id]);
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: "Class level not found." });
    }
    res.status(200).json({ message: "Class level deleted successfully." });
  } catch (error) {
    console.error(`Error deleting class level ${id}:`, error);
    res.status(500).json({ error: "Failed to delete class level." });
  }
});

module.exports = router;

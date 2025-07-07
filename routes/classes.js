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
 * @description Fetch all classes from the database, including their associated class level name.
 * @access Authenticated (any authenticated user can view classes)
 */
router.get('/', auth, async (req, res) => {
  try {
    // Select 'level' as class_level_id for consistency if needed, and join with class_levels
    const classes = await pool.query(
      "SELECT c.class_id, c.name, c.class_code, c.level AS class_level_id, cl.level_name AS level_name " +
      "FROM classes c " +
      "LEFT JOIN class_levels cl ON c.level = cl.level_id " +
      "ORDER BY c.name ASC"
    );
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
 * @body {string} name - The name of the class (e.g., "JSS1 Alpha")
 * @body {string} class_code - The code for the class (e.g., "JSS1A")
 * @body {number} level_id - The ID of the associated class level (from class_levels table)
 */
router.post('/', auth, isAdmin, async (req, res) => {
  const { name, class_code, level_id } = req.body; // Expect level_id from frontend
  if (!name || !class_code || !level_id) {
    return res.status(400).json({ error: "Class name, code, and level are required." });
  }
  try {
    const newClass = await pool.query(
      // Insert into 'level' column using level_id
      "INSERT INTO classes (name, class_code, level) VALUES ($1, $2, $3) RETURNING *",
      [name, class_code.toUpperCase(), level_id]
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
 * @route PUT /api/classes/:id
 * @description Update an existing class. Admin only.
 * @access Admin
 * @param {string} id - The class_id of the class to update.
 * @body {string} name - The new name of the class.
 * @body {string} class_code - The new code for the class.
 * @body {number} level_id - The new ID of the associated class level.
 */
router.put('/:id', auth, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, class_code, level_id } = req.body;
  if (!name || !class_code || !level_id) {
    return res.status(400).json({ error: "Class name, code, and level are required for update." });
  }
  try {
    const updatedClass = await pool.query(
      // Update 'level' column using level_id
      "UPDATE classes SET name = $1, class_code = $2, level = $3, updated_at = NOW() WHERE class_id = $4 RETURNING *",
      [name, class_code.toUpperCase(), level_id, id]
    );
    if (updatedClass.rows.length === 0) {
      return res.status(404).json({ error: "Class not found." });
    }
    res.json(updatedClass.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: `A class with this name or code already exists.` });
    }
    console.error(`Error updating class ${id}:`, error);
    res.status(500).json({ error: "Failed to update class." });
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
    // **Professional Check**: Consider adding checks for dependencies if specific 'classes' (not just 'class_levels')
    // are directly referenced by other tables (e.g., in an 'enrollments' table specific to this 'classes' table).
    // Based on provided info, users are linked to class_levels, not 'classes' table directly.
    // So, we're removing the previous check for 'users WHERE class_id = $1'.

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
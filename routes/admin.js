const express = require("express");
const router = express.Router(); // Initialize Express Router
const pool = require("../database/db"); // Assuming your database connection pool is here
const auth = require("../middlewares/auth"); // Assuming your authentication middleware is here

// NEW ROUTE: GET Admin Statistics
router.get("/admin/stats", auth, async (req, res) => {
    try {
        const requestingUser = req.user;

        // Authorization: Only admin can access this route
        if (!requestingUser.is_admin) {
            return res.status(403).json({ error: "Unauthorized: Only administrators can view admin statistics." });
        }

        const totalUsersQuery = await pool.query(`SELECT COUNT(*) FROM users`);
        const totalSubjectsQuery = await pool.query(`SELECT COUNT(*) FROM subjects`);
        const totalExamsQuery = await pool.query(`SELECT COUNT(*) FROM exams`);
        const totalClassLevelsQuery = await pool.query(`SELECT COUNT(*) FROM class_levels`);
        const totalClassesQuery = await pool.query(`SELECT COUNT(*) FROM classes`); // Assuming 'classes' table exists

        res.json({
            totalUsers: parseInt(totalUsersQuery.rows[0].count) || 0,
            totalSubjects: parseInt(totalSubjectsQuery.rows[0].count) || 0,
            totalExams: parseInt(totalExamsQuery.rows[0].count) || 0,
            totalClassLevels: parseInt(totalClassLevelsQuery.rows[0].count) || 0,
            totalClasses: parseInt(totalClassesQuery.rows[0].count) || 0,
        });

    } catch (error) {
        console.error("Error fetching admin statistics:", error);
        res.status(500).json({ error: "Failed to fetch admin statistics: " + error.message });
    }
});

module.exports = router; // Export the router

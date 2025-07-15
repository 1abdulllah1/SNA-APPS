const express = require("express");
const router = express.Router(); // Initialize Express Router
const pool = require("../database/db"); // Assuming your database connection pool is here
const auth = require("../middlewares/auth"); // Assuming your authentication middleware is here

// FIXED: GET Admin Statistics
// The route path was changed from "/admin/stats" to "/stats".
// This assumes your main server file mounts this router at "/api/admin",
// making the final, correct URL "/api/admin/stats". This should fix the 404 error.
router.get("/stats", auth, async (req, res) => {
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
        // Assuming 'classes' refers to distinct class levels assigned to students, which is more robust
        // than relying on a separate 'classes' table that might not exist.
        const totalClassesQuery = await pool.query(`SELECT COUNT(DISTINCT class_level_id) FROM users WHERE role = 'student' AND class_level_id IS NOT NULL`);

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

const auth = require("../middlewares/auth");
const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'profile_pictures');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        // Sanitize filename further
        const baseName = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9_.-]/g, '_');
        cb(null, `${baseName}-${uniqueSuffix}${extension}`);
    }
});
const fileFilter = (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        req.fileValidationError = 'Only image files (jpg, jpeg, png, gif) are allowed!';
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// USER REGISTRATION
router.post("/register", auth, upload.single('profile_picture'), async (req, res) => {
    if (!req.user.is_admin) {
        if (req.file) fs.unlink(req.file.path, err => { if (err) console.error("Error deleting temp file on auth failure (register):", err); });
        return res.status(403).json({ error: "Admin access required" });
    }
    if (req.fileValidationError) return res.status(400).json({ error: req.fileValidationError, field: "profile_picture" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { role, email, first_name, last_name, password, admission_number, class_level, username: bodyUsername, dob, gender } = req.body;
        
        let username = bodyUsername || '';
        let final_admission_number = null;
        let profile_picture_url = req.file ? `/uploads/profile_pictures/${req.file.filename}` : null;

        if (!email || !first_name || !last_name || !password || !role) {
            throw new Error("Missing required fields (email, first/last name, password, role)");
        }

        if (role === 'student') {
            if (!admission_number) throw new Error("Admission number is required for students");
            // UPDATED REGEX for SNA/YY/001 format
            const admissionRegex = /^SNA\/\d{2}\/\d{3}$/i; // Case insensitive for SNA, YY for year
            if (!admissionRegex.test(admission_number)) {
                throw new Error("Invalid admission number format. Use SNA/YY/001 (e.g., SNA/23/001)");
            }
            if (!class_level || class_level.trim() === "") throw new Error("Class level is required for students");
            if (!username) username = admission_number.toUpperCase(); // Default username to admission number
            final_admission_number = admission_number.toUpperCase();
        } else if (role === 'teacher' || role === 'admin') {
            if (!username) username = email.split('@')[0]; // Default username from email prefix
            // Teachers/Admins do not have admission numbers or student class levels
            if (admission_number || class_level) {
                 console.warn(`Admission number/class level provided for non-student role ${role}. These will be ignored.`);
            }
        } else {
            throw new Error("Invalid user role specified");
        }

        const checkUserConditions = ["lower(email) = lower($1)", "lower(username) = lower($2)"];
        const checkUserParams = [email, username];
        if (final_admission_number) {
            checkUserConditions.push("upper(admission_number) = upper($" + (checkUserParams.length + 1) + ")");
            checkUserParams.push(final_admission_number);
        }
        const existingUser = await client.query(`SELECT id FROM users WHERE ${checkUserConditions.join(" OR ")}`, checkUserParams);
        if (existingUser.rows.length > 0) {
             const existingFields = [];
             if (existingUser.rows[0].email && existingUser.rows[0].email.toLowerCase() === email.toLowerCase()) existingFields.push("email");
             if (existingUser.rows[0].username && existingUser.rows[0].username.toLowerCase() === username.toLowerCase()) existingFields.push("username");
             if (final_admission_number && existingUser.rows[0].admission_number && existingUser.rows[0].admission_number.toUpperCase() === final_admission_number) existingFields.push("admission number");
            throw new Error(`User with this ${existingFields.join(" or ")} already exists.`);
        }


        const hashedPassword = await bcrypt.hash(password, 10);
        let finalDob = null;
        if (dob) {
            const parsedDate = new Date(dob);
            if (!isNaN(parsedDate.getTime())) finalDob = parsedDate.toISOString().split('T')[0];
        }

        const result = await client.query(
            `INSERT INTO users (username, password, email, admission_number, role, first_name, last_name, is_admin, class_level, profile_picture_url, dob, gender)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, username, email, role, admission_number, is_admin, first_name, last_name, class_level, profile_picture_url, to_char(dob, 'YYYY-MM-DD') as dob, gender`,
            [username, hashedPassword, email, final_admission_number, role, first_name, last_name, (role === 'admin'), (role === 'student' ? class_level : null), profile_picture_url, finalDob, gender || null]
        );
        await client.query('COMMIT');
        res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        if (req.file) fs.unlink(req.file.path, err => { if (err) console.error("Error deleting temp file on registration error:", err); });
        console.error("Registration error:", error);
        res.status(400).json({ error: error.message || "Failed to register user." });
    } finally {
        client.release();
    }
});

// USER LOGIN
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) return res.status(400).json({ error: "Identifier and password are required" });

        const cleanIdentifier = identifier.trim();
        let userResult;
        // UPDATED REGEX for SNA/YY/001 format
        if (cleanIdentifier.includes('@')) {
            userResult = await pool.query("SELECT * FROM users WHERE lower(email) = lower($1)", [cleanIdentifier]);
        } else if (/^SNA\/\d{2}\/\d{3}$/i.test(cleanIdentifier)) { // Case insensitive check
            userResult = await pool.query("SELECT * FROM users WHERE upper(admission_number) = upper($1)", [cleanIdentifier]);
        } else {
            userResult = await pool.query("SELECT * FROM users WHERE lower(username) = lower($1)", [cleanIdentifier]);
        }

        if (userResult.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
        const user = userResult.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, is_admin: user.is_admin },
            process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
        );
        res.cookie('jwt', token, {
            httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax',
            maxAge: (parseInt(process.env.JWT_EXPIRES_IN_SECONDS) || 24 * 60 * 60) * 1000
        });
        res.status(200).json({ message: "Login successful", user: { id: user.id, username: user.username, email: user.email, role: user.role, is_admin: user.is_admin, first_name: user.first_name, last_name: user.last_name, profile_picture_url: user.profile_picture_url } });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed due to a server error." });
    }
});

// GET CURRENT USER
router.get("/me", auth, async (req, res) => {
    try {
        const userQuery = await pool.query(
            "SELECT id, username, email, role, is_admin, first_name, last_name, admission_number, class_level, profile_picture_url, to_char(dob, 'YYYY-MM-DD') as dob, gender FROM users WHERE id = $1",
            [req.user.id]
        );
        if (userQuery.rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(userQuery.rows[0]);
    } catch (error) {
        console.error("Get /me error:", error);
        res.status(500).json({ error: "Failed to fetch user data" });
    }
});

// GET ALL USERS (Admin only)
router.get("/", auth, async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: "Admin access required." });
    try {
        const result = await pool.query("SELECT id, username, email, role, admission_number, first_name, last_name, class_level, is_admin, profile_picture_url FROM users ORDER BY last_name, first_name");
        res.json(result.rows);
    } catch (error) {
        console.error("Get all users error:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// GET SINGLE USER (for editing, Admin only)
router.get("/:userId", auth, async (req, res) => {
    if (!req.user.is_admin && req.user.id !== parseInt(req.params.userId)) { // Allow user to fetch their own for profile editing
        // For more granular control, check specific fields user is allowed to edit vs admin
        // return res.status(403).json({ error: "Access denied." });
    }
    try {
        const { userId } = req.params;
        if (isNaN(parseInt(userId))) return res.status(400).json({error: "Invalid User ID"});

        const userQuery = await pool.query(
            `SELECT id, username, email, role, admission_number, first_name, last_name, class_level, is_admin, profile_picture_url,
                    to_char(dob, 'YYYY-MM-DD') as dob, gender 
             FROM users WHERE id = $1`, [userId]); // Format dob for input type=date
        if (userQuery.rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(userQuery.rows[0]);
    } catch (error) {
        console.error("Get single user error:", error);
        res.status(500).json({ error: "Failed to fetch user data" });
    }
});

// UPDATE USER (Admin only or user themselves for limited fields)
router.put("/:userId", auth, upload.single('profile_picture'), async (req, res) => {
    const { userId } = req.params;
    const loggedInUserId = req.user.id;
    const isAdmin = req.user.is_admin;

    if (!isAdmin && loggedInUserId !== parseInt(userId)) {
        if (req.file) fs.unlink(req.file.path, err => { if (err) console.error("Error deleting temp file on auth failure (update):", err); });
        return res.status(403).json({ error: "Not authorized to update this user." });
    }
     if (req.fileValidationError) return res.status(400).json({ error: req.fileValidationError, field: "profile_picture" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { first_name, last_name, email, username, role, class_level, admission_number, dob, gender, change_password, remove_profile_picture } = req.body;
        let { password } = req.body;

        const currentUserDataQuery = await client.query("SELECT profile_picture_url, role as current_role FROM users WHERE id = $1", [userId]);
        if (currentUserDataQuery.rows.length === 0) throw new Error("User not found.");
        const currentUserDbData = currentUserDataQuery.rows[0];

        let new_profile_picture_url = currentUserDbData.profile_picture_url;
        if (req.file) {
            if (new_profile_picture_url) { // Delete old one
                const oldFilePath = path.join(__dirname, '..', 'public', new_profile_picture_url);
                if (fs.existsSync(oldFilePath)) fs.unlink(oldFilePath, err => { if (err) console.error("Error deleting old profile picture:", err); });
            }
            new_profile_picture_url = `/uploads/profile_pictures/${req.file.filename}`;
        } else if (remove_profile_picture === 'true' && new_profile_picture_url) {
            const oldFilePath = path.join(__dirname, '..', 'public', new_profile_picture_url);
            if (fs.existsSync(oldFilePath)) fs.unlink(oldFilePath, err => { if (err) console.error("Error deleting profile picture on removal:", err); });
            new_profile_picture_url = null;
        }

        const updateFields = [];
        const queryParams = [];
        let paramIndex = 1;

        // Fields editable by admin or user themselves (with more restrictive logic for self-edit if needed)
        if (first_name) { updateFields.push(`first_name = $${paramIndex++}`); queryParams.push(first_name); }
        if (last_name) { updateFields.push(`last_name = $${paramIndex++}`); queryParams.push(last_name); }
        // Email and username changes might need uniqueness checks similar to registration
        if (email) { updateFields.push(`email = $${paramIndex++}`); queryParams.push(email); }
        if (username) { updateFields.push(`username = $${paramIndex++}`); queryParams.push(username); }
        
        if (new_profile_picture_url !== currentUserDbData.profile_picture_url) {
             updateFields.push(`profile_picture_url = $${paramIndex++}`); queryParams.push(new_profile_picture_url);
        }
        if (dob) { 
            const parsedDate = new Date(dob); // Ensure dob is valid before pushing
            if (!isNaN(parsedDate.getTime())) { updateFields.push(`dob = $${paramIndex++}`); queryParams.push(parsedDate.toISOString().split('T')[0]); }
        } else if (dob === '') { // Explicitly set to null if cleared
            updateFields.push(`dob = NULL`);
        }
        if (gender !== undefined) { updateFields.push(`gender = $${paramIndex++}`); queryParams.push(gender === '' ? null : gender); }


        // Fields typically only editable by Admin
        if (isAdmin) {
            if (role) { updateFields.push(`role = $${paramIndex++}`); queryParams.push(role); }
            const effectiveRole = role || currentUserDbData.current_role; // Use new role if provided, else current

            if (effectiveRole === 'student') {
                if (class_level) { updateFields.push(`class_level = $${paramIndex++}`); queryParams.push(class_level); }
                if (admission_number) {
                    const admissionRegex = /^SNA\/\d{2}\/\d{3}$/i;
                    if (!admissionRegex.test(admission_number)) throw new Error("Invalid admission number format. Use SNA/YY/001");
                    updateFields.push(`admission_number = $${paramIndex++}`); queryParams.push(admission_number.toUpperCase());
                }
            } else { // If role is changed from student or is not student
                updateFields.push(`class_level = NULL`);
                updateFields.push(`admission_number = NULL`);
            }
        }

        if (change_password === 'on') {
            if (!password) throw new Error("New password cannot be empty if 'Change Password' is checked.");
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push(`password = $${paramIndex++}`); queryParams.push(hashedPassword);
        }

        if (updateFields.length === 0 && new_profile_picture_url === currentUserDbData.profile_picture_url) {
            // If only profile picture changed and it's handled above, this might not run.
            // Ensure that if ONLY profile picture changes, it still updates.
            // The `new_profile_picture_url !== currentUserDbData.profile_picture_url` check already handles this.
            // If that's the ONLY change, updateFields might be empty.
             if (new_profile_picture_url !== currentUserDbData.profile_picture_url && updateFields.length === 0) {
                // This case implies only profile picture URL changed, which is already added to updateFields
             } else if (updateFields.length === 0) {
                 return res.status(200).json({ message: "No changes provided to update.", user: currentUserDbDataQuery.rows[0] });
             }
        }


        queryParams.push(userId);
        const updateQuery = `UPDATE users SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING id, username, email, role, admission_number, first_name, last_name, class_level, is_admin, profile_picture_url, to_char(dob, 'YYYY-MM-DD') as dob, gender`;
        
        const result = await client.query(updateQuery, queryParams);
        await client.query('COMMIT');
        res.json({ message: "User updated successfully", user: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        if (req.file) fs.unlink(req.file.path, err => { if (err) console.error("Error deleting temp file on update error:", err);});
        console.error("Update user error:", error);
        res.status(400).json({ error: error.message || "Failed to update user." });
    } finally {
        client.release();
    }
});

// DELETE USER (Admin only)
router.delete("/:userId", auth, async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: "Admin access required." });
    const { userId } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userResult = await client.query("SELECT profile_picture_url, role FROM users WHERE id = $1", [userId]);
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK'); // Rollback if user not found before releasing
            client.release();
            return res.status(404).json({ error: "User not found." });
        }
        const userToDelete = userResult.rows[0];

        // Manual deletion of dependent records IF ON DELETE CASCADE is NOT set in DB
        // For exam_sessions linked to this user:
        await client.query("DELETE FROM exam_sessions WHERE user_id = $1", [userId]);
        // For exam_results linked to this student:
        if (userToDelete.role === 'student') {
            await client.query("DELETE FROM exam_results WHERE student_id = $1", [userId]);
        }
        // For exams created by this user (if teacher/admin):
        // Decide policy: delete exams, or set created_by to NULL, or prevent user deletion.
        // Example: Set created_by to NULL (if your DB schema allows NULL for exams.created_by)
        // await client.query("UPDATE exams SET created_by = NULL WHERE created_by = $1", [userId]); 
        // OR to delete exams they created (more destructive):
        // const teacherExams = await client.query("SELECT exam_id FROM exams WHERE created_by = $1", [userId]);
        // for (const exam of teacherExams.rows) {
        //     await client.query("DELETE FROM exam_results WHERE exam_id = $1", [exam.exam_id]);
        //     await client.query("DELETE FROM questions WHERE exam_id = $1", [exam.exam_id]);
        //     await client.query("DELETE FROM exam_sessions WHERE exam_id = $1", [exam.exam_id]);
        //     await client.query("DELETE FROM exams WHERE exam_id = $1", [exam.exam_id]);
        // }


        const deleteResult = await client.query("DELETE FROM users WHERE id = $1 RETURNING id", [userId]);
        if (deleteResult.rowCount === 0) throw new Error("User deletion failed unexpectedly after checks.");

        if (userToDelete.profile_picture_url) {
            const filePath = path.join(__dirname, '..', 'public', userToDelete.profile_picture_url);
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, err => { if (err) console.error(`Failed to delete profile picture for user ${userId}:`, err); });
            }
        }
        await client.query('COMMIT');
        res.json({ message: "User and associated data (like sessions, results) deleted successfully." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Delete user error:", error);
         if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({ error: `Cannot delete user: still referenced by other records. Please resolve dependencies. Detail: ${error.detail || error.message}` });
        }
        res.status(500).json({ error: "Failed to delete user. " + error.message });
    } finally {
        client.release();
    }
});

// LOGOUT USER
router.post("/logout", (req, res) => {
    res.clearCookie('jwt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' });
    res.status(200).json({ message: "Logged out successfully" });
});

module.exports = router;

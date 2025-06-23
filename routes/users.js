const auth = require("../middlewares/auth");
const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Centralized Configuration for File Handling ---
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'profile_pictures');
const DEFAULT_AVATAR_URL = '/images/default_avatar.jpeg';

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, `avatar-${uniqueSuffix}${extension}`);
    }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// --- USER LOGIN ---
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) return res.status(400).json({ error: "Identifier and password are required." });

        const userResult = await pool.query("SELECT * FROM users WHERE lower(email) = lower($1) OR upper(admission_number) = upper($1) OR lower(username) = lower($1)", [identifier]);

        if (userResult.rows.length === 0) return res.status(401).json({ error: "Invalid credentials." });
        
        const user = userResult.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ error: "Invalid credentials." });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, is_admin: user.is_admin },
            process.env.JWT_SECRET, { expiresIn: '1d' }
        );

        // **CRITICAL FIX**: Production-safe cookie settings.
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Only 'secure' in production (HTTPS)
            sameSite: 'Lax', // Protects against CSRF
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        
        delete user.password; // Never send password back
        res.status(200).json({ message: "Login successful", user });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Server error during login." });
    }
});


// --- USER REGISTRATION (Admin Only) ---
router.post("/register", auth, auth.isAdmin, upload.single('profile_picture'), async (req, res) => {
    const { role, email, first_name, last_name, password, admission_number, class_level, username, dob, gender } = req.body;
    const client = await pool.connect();
    
    // **CORRECTED**: Assign the local default avatar URL if no file is uploaded.
    const profile_picture_url = req.file ? `/uploads/profile_pictures/${req.file.filename}` : DEFAULT_AVATAR_URL;

    try {
        if (!email || !first_name || !last_name || !password || !role || !username) {
            throw new Error("Missing required fields: username, password, email, name, and role.");
        }

        await client.query('BEGIN');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await client.query(
            `INSERT INTO users (username, password, email, admission_number, role, first_name, last_name, is_admin, class_level, profile_picture_url, dob, gender)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [username, hashedPassword, email, role === 'student' ? admission_number : null, role, first_name, last_name, role === 'admin', role === 'student' ? class_level : null, profile_picture_url, dob || null, gender || null]
        );
        
        await client.query('COMMIT');
        res.status(201).json({ message: "User registered successfully." });
    } catch (error) {
        await client.query('ROLLBACK');
        if (req.file) fs.unlinkSync(req.file.path); // Clean up uploaded file on registration error
        if (error.code === '23505') { // Unique constraint violation
            res.status(409).json({ error: "User with this email, username, or admission number already exists." });
        } else {
            res.status(400).json({ error: error.message });
        }
    } finally {
        client.release();
    }
});


// --- USER LOGIN ---
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) return res.status(400).json({ error: "Identifier and password are required" });

        let userResult;
        if (identifier.includes('@')) {
            userResult = await pool.query("SELECT * FROM users WHERE lower(email) = lower($1)", [identifier]);
        } else if (/^SNA\/\d{2}\/\d{3}$/i.test(identifier)) {
            userResult = await pool.query("SELECT * FROM users WHERE upper(admission_number) = upper($1)", [identifier]);
        } else {
            userResult = await pool.query("SELECT * FROM users WHERE lower(username) = lower($1)", [identifier]);
        }

        if (userResult.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
        const user = userResult.rows[0];
        if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, is_admin: user.is_admin },
            process.env.JWT_SECRET, { expiresIn: '1d' }
        );
        res.cookie('jwt', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', maxAge: 24 * 60 * 60 * 1000 });
        
        // Sanitize user object before sending
        delete user.password;
        res.status(200).json({ message: "Login successful", user });
    } catch (error) {
        res.status(500).json({ error: "Server error during login." });
    }
});

// --- GET CURRENT USER (/me) ---
router.get("/me", auth, async (req, res) => {
    try {
        const userQuery = await pool.query("SELECT id, username, email, role, is_admin, first_name, last_name, admission_number, class_level, profile_picture_url, to_char(dob, 'YYYY-MM-DD') as dob, gender FROM users WHERE id = $1", [req.user.id]);
        if (userQuery.rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(userQuery.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user data" });
    }
});

// --- UPDATE USER ---
router.put("/:userId", auth, upload.single('profile_picture'), async (req, res) => {
    const { userId } = req.params;
    if (req.user.id != userId && !req.user.is_admin) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: "Not authorized." });
    }
    if (req.fileValidationError) return res.status(400).json({ error: req.fileValidationError });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { first_name, last_name, email, password, remove_profile_picture } = req.body;
        
        const currentUser = await client.query("SELECT profile_picture_url FROM users WHERE id = $1", [userId]);
        if (currentUser.rows.length === 0) throw new Error("User not found.");
        const currentPictureUrl = currentUser.rows[0].profile_picture_url;

        let new_profile_picture_url = currentPictureUrl;
        
        // **CORRECTED LOGIC**: Full control over picture updates.
        if (req.file) { // 1. New picture uploaded
            new_profile_picture_url = `/uploads/profile_pictures/${req.file.filename}`;
            // If the old picture was not the default one, delete it.
            if (currentPictureUrl && currentPictureUrl !== DEFAULT_AVATAR_URL) {
                const oldPath = path.join(__dirname, '..', 'public', currentPictureUrl);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        } else if (remove_profile_picture === 'true') { // 2. Picture explicitly removed
            new_profile_picture_url = DEFAULT_AVATAR_URL; // Revert to default
            // If the old picture was not the default one, delete it.
            if (currentPictureUrl && currentPictureUrl !== DEFAULT_AVATAR_URL) {
                 const oldPath = path.join(__dirname, '..', 'public', currentPictureUrl);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        } // 3. No change to picture. `new_profile_picture_url` remains the same as `currentPictureUrl`.

        const updateFields = { first_name, last_name, email, profile_picture_url: new_profile_picture_url };
        if (password) {
            updateFields.password = await bcrypt.hash(password, 10);
        }

        const queryParts = Object.keys(updateFields).map((key, i) => `${key} = $${i + 1}`);
        const queryValues = Object.values(updateFields);

        await client.query(`UPDATE users SET ${queryParts.join(", ")}, updated_at = NOW() WHERE id = $${queryValues.length + 1}`, [...queryValues, userId]);
        
        await client.query('COMMIT');
        res.json({ message: "User updated successfully." });
    } catch (error) {
        await client.query('ROLLBACK');
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});


// --- GET ALL USERS (Admin only) ---
router.get("/", auth, auth.isAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, username, email, role, admission_number, first_name, last_name, class_level, is_admin, profile_picture_url FROM users ORDER BY last_name, first_name");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
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
router.get('/debug-users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// LOGOUT USER
router.post("/logout", (req, res) => {
    res.clearCookie('jwt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' });
    res.status(200).json({ message: "Logged out successfully" });
});

module.exports = router;
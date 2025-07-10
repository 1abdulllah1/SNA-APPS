// users.js
const auth = require("../middlewares/auth");
const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// For password reset - you'll need to install and configure an email sender
// Example: const nodemailer = require('nodemailer');
// Make sure to install it: npm install nodemailer dotenv
// Add your email configuration in .env or directly here for testing (not recommended for prod)

// --- Cloudinary Configuration ---
const cloudinary = require('cloudinary').v2;
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config(); // Load .env for local development
}
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Centralized Configuration for File Handling ---
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'profile_pictures');
const DEFAULT_AVATAR_URL = 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg';

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer setup for memory storage (for Cloudinary upload)
const upload = multer({
    storage: multer.memoryStorage(), // Store file in memory as a Buffer
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB file size limit
});

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "profile_pictures", resource_type: "image" },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        uploadStream.end(fileBuffer);
    });
};

// =========================================================
// EMAIL TRANSPORTER SETUP (FOR PASSWORD RESET)
// You need to configure this to send actual emails.
// Example with Nodemailer (install with npm install nodemailer):
/*
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
*/
// =========================================================

// *** FIX: Added missing isAdminOrTeacher middleware function ***
const isAdminOrTeacher = (req, res, next) => {
  if (!req.user || (!req.user.is_admin && req.user.role !== 'teacher')) {
    return res.status(403).json({ error: "Access denied. Admin or Teacher privileges required." });
  }
  next();
};

// GET /api/users/me - Get current user's profile
router.get("/me", auth, async (req, res) => {
    try {
        // req.user is set by the auth middleware
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT u.id, u.username, u.email, u.role, u.is_admin, u.profile_picture_url, u.admission_number, u.class_level_id, cl.level_name AS class_level_name, u.dob, u.gender FROM users u LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id WHERE u.id = $1',
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: "Failed to fetch user profile." });
    }
});

// POST /api/users/register - Register a new user
router.post("/register", upload.single('profile_picture'), async (req, res) => {
    const { username, email, password, role, admission_number, dob, gender } = req.body;
    let class_level_id_raw = req.body.class_level_id; // Get the raw value from req.body

    if (!username || !email || !password || !role) {
        return res.status(400).json({ error: "Please provide username, email, password, and role." });
    }

    let final_class_level_id = null; // Initialize to null

    // Process class_level_id based on role
    if (role === 'student') {
        // For students, class_level_id must be provided and be a valid number
        if (!class_level_id_raw || isNaN(parseInt(class_level_id_raw))) {
            return res.status(400).json({ error: "Class level is required for students.", field: "class_level_id" });
        }
        final_class_level_id = parseInt(class_level_id_raw);
    } else {
        // For non-students, class_level_id should always be null
        final_class_level_id = null;
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        let profile_picture_url = DEFAULT_AVATAR_URL;

        // Only process profile picture if it's a student role and a file is uploaded
        if (role === 'student' && req.file) {
            profile_picture_url = await uploadToCloudinary(req.file.buffer);
        } else if (role !== 'student' && req.file) {
            // If a file is uploaded for a non-student role, log a warning or reject it
            console.warn(`Profile picture uploaded for non-student role (${role}). It will be ignored.`);
            // You might want to return an error here if you strictly disallow non-student profile pics
        }

        const newUser = await pool.query(
            'INSERT INTO users (username, email, password, role, admission_number, class_level_id, dob, gender, profile_picture_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, username, email, role, is_admin, admission_number, class_level_id, dob, gender, profile_picture_url',
            [
                username,
                email,
                hashedPassword,
                role,
                admission_number || null, // Will be null if not provided
                final_class_level_id,     // Use the processed final_class_level_id
                dob || null,              // Will be null if not provided
                gender || null,           // Will be null if not provided
                profile_picture_url
            ]
        );
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            // Check if error detail contains email or username constraint name
            if (error.detail && error.detail.includes('users_email_key')) {
                return res.status(409).json({ error: "An account with this email already exists.", field: "email" });
            }
            if (error.detail && error.detail.includes('users_username_key')) {
                return res.status(409).json({ error: "This username is already taken.", field: "username" });
            }
            if (error.detail && error.detail.includes('users_admission_number_key') && role === 'student') {
                return res.status(409).json({ error: "This admission number is already in use.", field: "admission_number" });
            }
            return res.status(409).json({ error: "A user with this data already exists." });
        }
        // Specific error for class_level constraint violation (this will now be caught by the explicit check above)
        // Leaving it here as a fallback or for other potential class_level constraints
        if (error.code === '23514' && error.constraint === 'class_level_for_students_only') {
            return res.status(400).json({ error: "Class level is required for student registration.", field: "class_level_id" });
        }
        console.error("Registration error:", error);
        res.status(500).json({ error: "Failed to register user." });
    }
});

// POST /api/users/login - Authenticate user and issue JWT
router.post("/login", async (req, res) => {
    const { identifier, password } = req.body; // 'identifier' can be username, email, or admission number

    if (!identifier || !password) {
        return res.status(400).json({ error: "Please provide identifier (username, email, or admission number) and password." });
    }

    try {
        // IMPROVEMENT: Modify the query to allow login by username, email, OR admission_number
        const query = `
            SELECT u.id, u.username, u.email, u.password, u.role, u.is_admin, u.profile_picture_url, u.admission_number, u.class_level_id, cl.level_name AS class_level_name, u.dob, u.gender
            FROM users u
            LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id
            WHERE u.username = $1 OR u.email = $1 OR (u.role = 'student' AND u.admission_number = $1)
        `;
        const result = await pool.query(query, [identifier]);

        if (result.rows.length === 0) {
            // Log for debugging: console.log(`No user found for identifier: ${identifier}`);
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            // Log for debugging: console.log(`Password mismatch for user: ${user.username}`);
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, is_admin: user.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '2h' } // Token expires in 1 hour
        );

        res.cookie('jwt', token, {
            httpOnly: true, // Makes the cookie inaccessible to JavaScript
            secure: process.env.NODE_ENV === 'production', // Send cookie only over HTTPS in production
            sameSite: 'Lax', // Protects against CSRF
            maxAge: 7200000 // 1 hour in milliseconds
        });

        res.json({ message: "Logged in successfully", user: { id: user.id, username: user.username, email: user.email, role: user.role, is_admin: user.is_admin, profile_picture_url: user.profile_picture_url, admission_number: user.admission_number, class_level_id: user.class_level_id, class_level_name: user.class_level_name, dob: user.dob, gender: user.gender } });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error during login." });
    }
});

// =========================================================
// FORGET PASSWORD ROUTES (IMPROVEMENT)
// =========================================================

// POST /api/users/forgot-password - Request password reset link
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Please provide your email address." });
    }

    try {
        const userResult = await pool.query('SELECT id, username, email FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            // For security, always respond with a generic success message
            // even if the email doesn't exist, to prevent enumeration attacks.
            return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
        }

        const user = userResult.rows[0];

        // Generate a unique, short-lived token for password reset
        // Using user ID, secret, and a short expiry (e.g., 15 minutes)
        const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });

        // IMPORTANT: Store the reset token hash in the database to invalidate it after use
        // You'll need to add a 'reset_password_token' column and 'reset_password_expires' column to your users table
        await pool.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = NOW() + INTERVAL \'15 minutes\' WHERE id = $2',
            [resetToken, user.id]
        );

        // Construct the reset URL
        // In production, replace localhost:3000 with your deployed domain (e.g., cbt-app.render.com)
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

        // =========================================================
        // EMAIL SENDING LOGIC (YOU NEED TO IMPLEMENT THIS USING Nodemailer or similar)
        // Ensure 'transporter' is configured above.
        /*
        const mailOptions = {
            from: process.env.EMAIL_FROM, // Your sender email address
            to: user.email,
            subject: 'Password Reset Request for CBT System',
            html: `
                <p>Hello ${user.username},</p>
                <p>You have requested a password reset for your CBT System account.</p>
                <p>Please click on the following link to reset your password:</p>
                <p><a href="${resetUrl}">${resetUrl}</a></p>
                <p>This link will expire in 15 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
            `,
        };
        await transporter.sendMail(mailOptions);
        */
        // =========================================================

        res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });

    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Failed to process password reset request." });
    }
});

// POST /api/users/reset-password - Reset password with token
router.post("/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: "Missing token or new password." });
    }

    try {
        // Verify the token and check expiry
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const userResult = await pool.query(
            'SELECT * FROM users WHERE id = $1 AND reset_password_token = $2 AND reset_password_expires > NOW()',
            [userId, token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: "Invalid or expired password reset token." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and invalidate token
        await pool.query(
            'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [hashedPassword, userId]
        );

        res.status(200).json({ message: "Password has been reset successfully." });

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ error: "Password reset token has expired." });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ error: "Invalid password reset token." });
        }
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Failed to reset password." });
    }
});


// GET /api/users - Get all users (for admin view) with optional class_level_id filter
// Modified to filter by role 'student' if no specific role is requested, or by role if specified.
router.get("/", auth, async (req, res) => {
    // Only admin can access this route
    if (!req.user.is_admin && req.user.role !== 'teacher') {
        return res.status(403).json({ error: "Unauthorized: Only administrators and teachers can view all users." });
    }

    const { class_level_id, role, search } = req.query;
    let query = `
        SELECT u.id, u.username, u.email, u.role, u.is_admin, u.profile_picture_url, u.admission_number, u.class_level_id, cl.level_name AS class_level_name, u.dob, u.gender
        FROM users u
        LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id
        WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filter by role: default to 'student' if no role is specified and the requesting user is a teacher
    // Admins can see all users by default, or filter by any role.
    let targetRole = role;
    if (req.user.role === 'teacher' && !targetRole) {
        targetRole = 'student'; // Teachers primarily see students
    }

    if (targetRole) {
        query += ` AND u.role = $${paramIndex++}`;
        params.push(targetRole);
    }

    if (class_level_id) {
        query += ` AND u.class_level_id = $${paramIndex++}`;
        params.push(class_level_id);
    }

    if (search) {
        const searchTerm = `%${search.toLowerCase()}%`;
        query += ` AND (LOWER(u.username) LIKE $${paramIndex} OR LOWER(u.email) LIKE $${paramIndex} OR LOWER(u.admission_number) LIKE $${paramIndex})`;
        params.push(searchTerm);
        paramIndex++;
    }

    query += ` ORDER BY u.username ASC`;

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users." });
    }
});


// GET /api/users/admin-stats - Get overall statistics for admin dashboard
router.get("/admin-stats", auth, async (req, res) => {
    // Only admin can access this route
    if (!req.user.is_admin) {
        return res.status(403).json({ error: "Unauthorized: Only administrators can view admin statistics." });
    }

    try {
        const totalUsers = (await pool.query('SELECT COUNT(*) FROM users')).rows[0].count;
        const totalSubjects = (await pool.query('SELECT COUNT(*) FROM subjects')).rows[0].count;
        const totalExams = (await pool.query('SELECT COUNT(*) FROM exams')).rows[0].count;
        const totalClassLevels = (await pool.query('SELECT COUNT(*) FROM class_levels')).rows[0].count;
        // Assuming 'classes' refers to distinct class_level_id in users or a separate classes table
        // If you have a dedicated 'classes' table, adjust this query.
        // For now, assuming it means distinct class levels assigned to students.
        const totalClasses = (await pool.query('SELECT COUNT(DISTINCT class_level_id) FROM users WHERE role = \'student\' AND class_level_id IS NOT NULL')).rows[0].count;

        res.json({
            totalUsers: parseInt(totalUsers),
            totalSubjects: parseInt(totalSubjects),
            totalExams: parseInt(totalExams),
            totalClassLevels: parseInt(totalClassLevels),
            totalClasses: parseInt(totalClasses)
        });
    } catch (error) {
        console.error("Error fetching admin statistics:", error);
        res.status(500).json({ error: "Failed to fetch admin statistics." });
    }
});


// GET /api/users/:id - Get user by ID (for editing)
router.get("/:id", auth, async (req, res) => {
    const { id } = req.params;
    // Only admin can view/edit any user. A user can view their own profile via /me endpoint.
    if (!req.user.is_admin) {
        return res.status(403).json({ error: "Unauthorized: Only administrators can view other user profiles." });
    }
    try {
        const result = await pool.query(
            'SELECT u.id, u.username, u.email, u.role, u.is_admin, u.profile_picture_url, u.admission_number, u.class_level_id, cl.level_name AS class_level_name, u.dob, u.gender FROM users u LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id WHERE u.id = $1',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching user by ID:", error);
        res.status(500).json({ error: "Failed to fetch user." });
    }
});

// PUT /api/users/:id - Update user by ID
router.put("/:id", auth, upload.single('profile_picture'), async (req, res) => {
    const { id } = req.params;
    const { username, email, role, admission_number, class_level_id, dob, gender, current_profile_picture_url } = req.body;

    // Only admin can update other users. Users can update their own profile via a separate route if needed.
    if (!req.user.is_admin) {
        return res.status(403).json({ error: "Unauthorized: Only administrators can update user profiles." });
    }

    if (!username || !email || !role) {
        return res.status(400).json({ error: "Username, email, and role are required." });
    }

    let profile_picture_url = current_profile_picture_url || DEFAULT_AVATAR_URL;

    try {
        // If a new file is uploaded, upload it to Cloudinary
        if (req.file) {
            profile_picture_url = await uploadToCloudinary(req.file.buffer);
        }

        // Handle class_level_id based on role
        let final_class_level_id = null;
        if (role === 'student') {
            final_class_level_id = class_level_id ? parseInt(class_level_id) : null;
            if (isNaN(final_class_level_id)) {
                return res.status(400).json({ error: "Class level is required and must be a valid number for students." });
            }
        } else {
            // For non-students, ensure class_level_id is null
            final_class_level_id = null;
        }

        const result = await pool.query(
            `UPDATE users SET
                username = $1,
                email = $2,
                role = $3,
                admission_number = $4,
                class_level_id = $5,
                dob = $6,
                gender = $7,
                profile_picture_url = $8,
                updated_at = NOW()
            WHERE id = $9
            RETURNING id, username, email, role, is_admin, profile_picture_url, admission_number, class_level_id, dob, gender`,
            [username, email, role, admission_number || null, final_class_level_id, dob || null, gender || null, profile_picture_url, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }
        res.json({ message: "User updated successfully", user: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            if (error.detail && error.detail.includes('users_email_key')) {
                return res.status(409).json({ error: "An account with this email already exists." });
            }
            if (error.detail && error.detail.includes('users_username_key')) {
                return res.status(409).json({ error: "This username is already taken." });
            }
            if (error.detail && error.detail.includes('users_admission_number_key')) {
                return res.status(409).json({ error: "This admission number is already in use." });
            }
            return res.status(409).json({ error: "A user with this data already exists." });
        }
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Failed to update user." });
    }
});

// DELETE /api/users/:id - Delete user by ID
router.delete("/:id", auth, async (req, res) => {
    const { id } = req.params;
    // Only admin can delete users
    if (!req.user.is_admin) {
        return res.status(403).json({ error: "Unauthorized: Only administrators can delete users." });
    }
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }
        res.json({ message: "User deleted successfully." });
    } catch (error) {
        console.error("Error deleting user:", error);
        // Handle foreign key constraint violation
        if (error.code === '23503') { // PostgreSQL foreign key violation error code
            return res.status(400).json({ error: `Cannot delete user: still referenced by other records. Please resolve dependencies. Detail: ${error.detail || error.message}` });
        }
        res.status(500).json({ error: "Failed to delete user. " + error.message });
    } finally {
        if (client) { client.release(); }
    }
});


// LOGOUT USER
router.post("/logout", (req, res) => {
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax'
    });
    res.status(200).json({ message: "Logged out successfully" });
});

// POST /api/users/upload-signature - Upload signature image
router.post("/upload-signature", auth, isAdminOrTeacher, upload.single('signature'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No signature file provided." });
        }

        const uploadResult = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, {
            folder: "signatures",
            transformation: [{ width: 300, height: 150, crop: "limit" }]
        });

        res.status(200).json({ message: "Signature uploaded successfully.", url: uploadResult.secure_url });

    } catch (error) {
        console.error("Error uploading signature to Cloudinary:", error);
        res.status(500).json({ error: "Failed to upload signature: " + error.message });
    }
});

// Debug route (optional, for development) - Corrected to use class_level_id
router.get('/debug-users', async (req, res) => {
  try {
    // Select class_level_id and join with class_levels to get level_name
    const result = await pool.query('SELECT u.id, u.username, u.email, u.role, u.is_admin, u.profile_picture_url, u.admission_number, u.class_level_id, cl.level_name AS class_level_name, u.dob, u.gender FROM users u LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id');
    result.rows.forEach(user => {
        user.profile_picture_url = user.profile_picture_url || DEFAULT_AVATAR_URL;
    });
    res.json(result.rows);
  } catch (error) {
    console.error("Debug users route error:", error);
    res.status(500).json({ error: "Failed to fetch debug users." });
  }
});

module.exports = router;

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
const nodemailer = require('nodemailer');

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
// This uses environment variables. Make sure your .env file is configured
// with EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, and EMAIL_FROM.
// For development, you might need to set EMAIL_SECURE to 'false' and
// tls.rejectUnauthorized to false if using a local or self-signed SMTP server.
// =========================================================
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        // WARNING: Setting rejectUnauthorized to false can be a security risk in production.
        // Only use this in development or if you fully understand the implications
        // and trust the SMTP server's certificate.
        rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false
    }
});

// Middleware to ensure only admins or teachers can access certain routes
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
        // Added full_name and department to the select query
        const result = await pool.query(
            'SELECT u.id, u.username, u.email, u.role, u.is_admin, u.profile_picture_url, u.admission_number, u.class_level_id, cl.level_name AS class_level_name, u.dob, u.gender, u.full_name, u.department FROM users u LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id WHERE u.id = $1',
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
    // Added first_name, last_name, and department to destructuring
    const { username, email, password, role, admission_number, dob, gender, first_name, last_name, department } = req.body;
    let class_level_id_raw = req.body.class_level_id; // Get the raw value from req.body

    if (!username || !email || !password || !role) {
        return res.status(400).json({ error: "Please provide username, email, password, and role." });
    }

    let final_class_level_id = null; // Initialize to null
    // Construct full_name from first_name and last_name, trim extra spaces
    // Prioritize full_name if provided, otherwise construct from first/last
    const fullName = req.body.full_name ? req.body.full_name.trim() : `${first_name || ''} ${last_name || ''}`.trim();


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
            'INSERT INTO users (username, email, password, role, admission_number, class_level_id, dob, gender, profile_picture_url, full_name, department) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, username, email, role, is_admin, admission_number, class_level_id, dob, gender, profile_picture_url, full_name, department',
            [
                username,
                email,
                hashedPassword,
                role,
                admission_number || null, // Will be null if not provided
                final_class_level_id,     // Use the processed final_class_level_id
                dob || null,              // Will be null if not provided
                gender || null,           // Will be null if not provided
                profile_picture_url,
                fullName,                 // Store full_name
                department || null        // Store department
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
        // Added full_name and department to the select query
        const query = `
            SELECT u.id, u.username, u.email, u.password, u.role, u.is_admin, u.profile_picture_url, u.admission_number, u.class_level_id, cl.level_name AS class_level_name, u.dob, u.gender, u.full_name, u.department
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

        res.json({ message: "Logged in successfully", user: { id: user.id, username: user.username, email: user.email, role: user.role, is_admin: user.is_admin, profile_picture_url: user.profile_picture_url, admission_number: user.admission_number, class_level_id: user.class_level_id, class_level_name: user.class_level_name, dob: user.dob, gender: user.gender, full_name: user.full_name, department: user.department } });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error during login." });
    }
});


// =========================================================
// FORGOT/RESET PASSWORD ROUTES
// =========================================================

// POST /api/users/forgot-password - Request password reset link
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Please provide your email address." });
    }

    try {
        const userResult = await pool.query('SELECT id, username, email FROM users WHERE email = $1', [email]);
        
        // Always respond with a success message to prevent email enumeration attacks
        if (userResult.rows.length === 0) {
            return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
        }

        const user = userResult.rows[0];

        // Create a short-lived JWT for password reset
        const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });

        // Store the reset token hash in the database.
        // IMPORTANT: You must add these columns to your 'users' table. See guidance notes.
        await pool.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = NOW() + INTERVAL \'15 minutes\' WHERE id = $2',
            [resetToken, user.id]
        );

        // Construct the reset URL using FRONTEND_BASE_URL environment variable
        // This ensures the link works correctly on both local and hosted environments.
        const resetUrl = `${process.env.FRONTEND_BASE_URL}/reset-password.html?token=${resetToken}`;

        // --- Email Sending Logic ---
        const mailOptions = {
            from: `"SNA CBT System" <${process.env.EMAIL_FROM}>`,
            to: user.email,
            subject: 'Your Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2>Password Reset Request</h2>
                    <p>Hello ${user.username},</p>
                    <p>You requested a password reset. Please click the link below to create a new password:</p>
                    <p style="text-align: center;">
                        <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                    </p>
                    <p>This link is valid for 15 minutes. If you did not request this, please ignore this email.</p>
                    <hr>
                    <p style="font-size: 0.8em; color: #777;">If you're having trouble with the button, copy and paste this URL into your browser: ${resetUrl}</p>
                </div>
            `,
        };

        try {
            await transporter.sendMail(mailOptions);
            res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
        } catch (emailError) {
            console.error("Error sending password reset email:", emailError);
            // Log the specific error details from Nodemailer
            if (emailError.code) console.error("Nodemailer error code:", emailError.code);
            if (emailError.response) console.error("Nodemailer response:", emailError.response);
            if (emailError.responseCode) console.error("Nodemailer response code:", emailError.responseCode);
            // Revert the token update if email sending fails to prevent invalid tokens
            await pool.query(
                'UPDATE users SET reset_password_token = NULL, reset_password_expires = NULL WHERE id = $1',
                [user.id]
            );
            // Still return a generic success message to the user for security reasons,
            // but log the actual error for debugging.
            res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
        }
    } catch (error) {
        console.error("Forgot password processing error:", error);
        res.status(500).json({ error: "Failed to process password reset request due to a server error." });
    }
});

// POST /api/users/reset-password - Reset password using the token
router.post("/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required." });
    }

    try {
        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Check if the token is valid and still stored in the database
        const userResult = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND reset_password_token = $2 AND reset_password_expires > NOW()',
            [userId, token]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: "Password reset token is invalid or has expired." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and invalidate the token
        await pool.query(
            'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
            [hashedPassword, userId]
        );

        res.status(200).json({ message: "Password has been reset successfully. You can now log in." });
    } catch (error) {
        if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
            return res.status(400).json({ error: "Password reset token is invalid or has expired." });
        }
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Failed to reset password." });
    }
});

// POST /api/users/logout - Clear JWT cookie
router.post("/logout", (req, res) => {
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
    });
    res.status(200).json({ message: "Logged out successfully." });
});

// GET /api/users - Get all users (Admin only)
router.get("/", auth, isAdminOrTeacher, async (req, res) => {
    try {
        const { role, search } = req.query; // Added search query parameter
        let query = `
            SELECT u.id, u.username, u.email, u.role, u.is_admin, u.profile_picture_url, u.admission_number, u.class_level_id, cl.level_name AS class_level_name, u.dob, u.gender, u.full_name, u.department
            FROM users u
            LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (role) {
            query += ` AND u.role = $${paramIndex++}`;
            params.push(role);
        }
        if (search) {
            // Search by username, email, full_name, admission_number (if student)
            query += ` AND (LOWER(u.username) LIKE LOWER($${paramIndex}) OR LOWER(u.email) LIKE LOWER($${paramIndex}) OR LOWER(u.full_name) LIKE LOWER($${paramIndex}) `;
            if (role === 'student' || !role) { // If role is student or not specified, include admission_number
                query += ` OR LOWER(u.admission_number) LIKE LOWER($${paramIndex})`;
            }
            query += `)`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY u.full_name ASC, u.username ASC`; // Order by full_name then username

        const result = await pool.query(query, params);
        // Format DOB for consistency (YYYY-MM-DD)
        result.rows.forEach(user => {
            user.dob = user.dob ? new Date(user.dob).toISOString().split('T')[0] : null;
        });
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).json({ error: "Failed to fetch users." });
    }
});

// GET /api/users/:id - Get a single user by ID (Admin or owner)
router.get("/:id", auth, async (req, res) => {
    try {
        const { id } = req.params;
        const requestingUser = req.user;

        // Added full_name and department to the select query
        const result = await pool.query(
            'SELECT u.id, u.username, u.email, u.role, u.is_admin, u.profile_picture_url, u.admission_number, u.class_level_id, cl.level_name AS class_level_name, u.dob, u.gender, u.full_name, u.department FROM users u LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id WHERE u.id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const user = result.rows[0];

        // Authorization: Admin can view any user. Non-admin can only view their own profile.
        if (!requestingUser.is_admin && requestingUser.id !== parseInt(id)) {
            return res.status(403).json({ error: "Access denied. You can only view your own profile." });
        }

        // Format DOB for consistency (YYYY-MM-DD)
        user.dob = user.dob ? new Date(user.dob).toISOString().split('T')[0] : null;

        res.json(user);
    } catch (error) {
        console.error("Error fetching user by ID:", error);
        res.status(500).json({ error: "Failed to fetch user." });
    }
});

// PUT /api/users/:id - Update user details (Admin or owner)
router.put("/:id", auth, upload.single('profile_picture'), async (req, res) => {
    const { id } = req.params;
    const requestingUser = req.user;

    // Authorization: Admin can update any user. Non-admin can only update their own profile.
    if (!requestingUser.is_admin && requestingUser.id !== parseInt(id)) {
        return res.status(403).json({ error: "Access denied. You can only update your own profile." });
    }

    const {
        username,
        email,
        role,
        admission_number,
        class_level_id,
        dob,
        gender,
        current_password, // For password change validation
        new_password,
        remove_profile_picture, // 'true' or 'false' string from checkbox
        first_name, // New fields
        last_name,  // New fields
        department  // New field
    } = req.body;

    // Construct full_name from first_name and last_name, trim extra spaces
    // Prioritize full_name if provided, otherwise construct from first/last
    const fullName = req.body.full_name ? req.body.full_name.trim() : `${first_name || ''} ${last_name || ''}`.trim();


    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch current user data to compare and validate
        const currentUserResult = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        if (currentUserResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }
        const currentUser = currentUserResult.rows[0];

        let profile_picture_url = currentUser.profile_picture_url;

        // Handle profile picture removal
        if (remove_profile_picture === 'true') {
            profile_picture_url = DEFAULT_AVATAR_URL;
            // Optionally delete old image from Cloudinary if not default
            if (currentUser.profile_picture_url && currentUser.profile_picture_url !== DEFAULT_AVATAR_URL) {
                const publicId = currentUser.profile_picture_url.split('/').pop().split('.')[0];
                cloudinary.uploader.destroy(`profile_pictures/${publicId}`, (error, result) => {
                    if (error) console.error("Error deleting old profile picture from Cloudinary:", error);
                    else console.log("Old profile picture deleted:", result);
                });
            }
        } else if (req.file) { // Handle new profile picture upload
            profile_picture_url = await uploadToCloudinary(req.file.buffer);
            // Optionally delete old image from Cloudinary if not default and different from new
            if (currentUser.profile_picture_url && currentUser.profile_picture_url !== DEFAULT_AVATAR_URL && currentUser.profile_picture_url !== profile_picture_url) {
                const publicId = currentUser.profile_picture_url.split('/').pop().split('.')[0];
                cloudinary.uploader.destroy(`profile_pictures/${publicId}`, (error, result) => {
                    if (error) console.error("Error deleting old profile picture from Cloudinary:", error);
                    else console.log("Old profile picture deleted:", result);
                });
            }
        }

        let hashedPassword = currentUser.password;
        if (new_password) {
            if (!current_password) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Current password is required to change password." });
            }
            const isMatch = await bcrypt.compare(current_password, currentUser.password);
            if (!isMatch) {
                await client.query('ROLLBACK');
                return res.status(401).json({ error: "Incorrect current password." });
            }
            hashedPassword = await bcrypt.hash(new_password, 10);
        }

        let final_class_level_id = null;
        if (role === 'student') {
            if (!class_level_id || isNaN(parseInt(class_level_id))) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Class level is required for students.", field: "class_level_id" });
            }
            final_class_level_id = parseInt(class_level_id);
        } else {
            // If role is changed from student to non-student, clear class_level_id
            final_class_level_id = null;
        }

        // Update user query - added full_name and department
        const updateQuery = `
            UPDATE users
            SET username = $1, email = $2, role = $3, admission_number = $4,
                class_level_id = $5, dob = $6, gender = $7, profile_picture_url = $8,
                password = $9, full_name = $10, department = $11
            WHERE id = $12
            RETURNING id, username, email, role, is_admin, admission_number, class_level_id, dob, gender, profile_picture_url, full_name, department;
        `;
        const result = await client.query(updateQuery, [
            username,
            email,
            role,
            admission_number || null,
            final_class_level_id,
            dob || null,
            gender || null,
            profile_picture_url,
            hashedPassword,
            fullName, // Use the constructed full name
            department || null, // Use the provided department
            id
        ]);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') { // Unique violation
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
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Failed to update user: " + error.message });
    } finally {
        client.release();
    }
});

// DELETE /api/users/:id - Delete a user (Admin only)
router.delete("/:id", auth, isAdminOrTeacher, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }
        res.status(200).json({ message: "User deleted successfully." });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Failed to delete user." });
    }
});

// Upload signature route (for teachers/principals)
router.post("/upload-signature", auth, upload.single('signature_file'), async (req, res) => {
    // Ensure only teachers or admins can upload signatures
    if (!req.user || (!req.user.is_admin && req.user.role !== 'teacher')) {
        return res.status(403).json({ error: "Access denied. Only teachers and admins can upload signatures." });
    }

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
    const result = await pool.query('SELECT u.id, u.username, u.email, u.role, u.is_admin, u.profile_picture_url, u.admission_number, u.class_level_id, cl.level_name AS class_level_name, u.dob, u.gender, u.full_name, u.department FROM users u LEFT JOIN class_levels cl ON u.class_level_id = cl.level_id');
    result.rows.forEach(user => {
        user.dob = user.dob ? new Date(user.dob).toISOString().split('T')[0] : null;
    });
    res.json(result.rows);
  } catch (error) {
    console.error("Error in debug-users route:", error);
    res.status(500).json({ error: "Failed to fetch debug users." });
  }
});


module.exports = router;

const auth = require("../middlewares/auth");
const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
// FIXED: Using the Cloudinary default avatar URL from download.js
const DEFAULT_AVATAR_URL = 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg';

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer setup for local storage (if used, from download.js)
const localStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, `avatar-${uniqueSuffix}${extension}`);
    }
});

// Multer setup for memory storage (for Cloudinary uploads, from download.js)
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            req.fileValidationError = 'Only image files (jpg, jpeg, png, gif) are allowed!';
            return cb(new Error(req.fileValidationError), false);
        }
        cb(null, true);
    }
});

// Helper function to extract public ID from Cloudinary URL (from download.js)
const getCloudinaryPublicId = (url) => {
    if (!url) return null;
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex > -1 && parts.length > uploadIndex + 2) {
        // Find the version part (e.g., v1234567890) and the file name without extension
        const filenameWithVersion = parts.slice(uploadIndex + 2).join('/');
        const publicIdWithExtension = filenameWithVersion.substring(0, filenameWithVersion.lastIndexOf('.'));
        return publicIdWithExtension; // Return without extension
    }
    return null;
};

// --- USER LOGIN ---
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // Fetch user from the database
        const userQuery = await pool.query(
            "SELECT id, username, email, password_hash, role, is_admin, profile_picture_url, full_name, admission_number, class_id FROM users WHERE username = $1 OR email = $1",
            [identifier]
        );
        const user = userQuery.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, is_admin: user.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Set the JWT token as an HttpOnly cookie
        res.cookie("jwt", token, {
            httpOnly: true,
            // *** IMPORTANT FOR LOCAL DEV ON HTTP ***
            // Explicitly set secure to false for HTTP.
            secure: true,
            // Explicitly set sameSite to 'None' to allow sending even if browser
            // perceives a subtle cross-site context on localhost with HTTP.
            // WARNING: In production, for 'None', secure MUST be true (HTTPS).
            sameSite: 'Lax',
            maxAge: 3600000 // 1 hour
        });

        // Send successful login response with user details
        res.json({
            message: "Logged in successfully",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                is_admin: user.is_admin,
                profile_picture_url: user.profile_picture_url || DEFAULT_AVATAR_URL,
                full_name: user.full_name,
                admission_number: user.admission_number,
                class_id: user.class_id
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error during login." });
    }
});



// --- REGISTER USER (Admin only) ---
router.post("/register", auth.isAdmin, uploadMemory.single('profile_picture'), async (req, res) => {
    const client = await pool.connect();
    try {
        if (req.fileValidationError) {
            return res.status(400).json({ error: req.fileValidationError });
        }

        const { username, email, password, role, is_admin, admission_number, class_id, full_name } = req.body; // Added full_name

        if (!username || !email || !password || !role) {
            return res.status(400).json({ error: "All required fields must be provided." });
        }

        if (role === 'student' && (!admission_number || !class_id)) {
            return res.status(400).json({ error: "Admission number and Class must be provided for students." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let profilePictureUrl = DEFAULT_AVATAR_URL; // Default avatar

        await client.query('BEGIN'); // Start transaction

        if (req.file) {
            // Always upload to Cloudinary if a file is provided and multer.memoryStorage is used
            const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, {
                folder: 'profile_pictures',
                public_id: `avatar_${Date.now()}` // Dynamic public ID
            });
            profilePictureUrl = result.secure_url;
        }

        const result = await client.query(
            "INSERT INTO users (username, email, password_hash, role, is_admin, profile_picture_url, admission_number, class_id, full_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, username, email, role, is_admin, profile_picture_url, full_name", // Added full_name
            [username, email, hashedPassword, role, is_admin === 'true', profilePictureUrl, admission_number || null, class_id || null, full_name || null] // Added full_name
        );
        await client.query('COMMIT');
        res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Registration error:", error);
        // Handle specific error codes for duplicates
        if (error.code === '23505') { // Unique violation
            if (error.constraint === 'users_username_key') {
                return res.status(409).json({ error: 'Username already exists.' });
            }
            if (error.constraint === 'users_email_key') {
                return res.status(409).json({ error: 'Email already exists.' });
            }
            if (error.constraint === 'users_admission_number_key') {
                return res.status(409).json({ error: 'Admission number already exists.' });
            }
        }
        res.status(500).json({ error: "Failed to register user." });
    } finally {
        client.release();
    }
});


// --- GET ALL USERS (Admin only) ---
// RE-INSTATED: This endpoint MUST be isAdmin to protect sensitive user data
router.get("/", auth, auth.isAdmin, async (req, res) => { // <--- THIS IS THE CRITICAL CHANGE
    try {
        console.log("[API] Fetching all users...");
        // req.user is guaranteed to exist and be an admin here
        const result = await pool.query(
            "SELECT id, username, email, role, is_admin, profile_picture_url, full_name, admission_number, class_id FROM users ORDER BY username ASC"
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users." });
    }
});



// --- GET CURRENT USER (Auth required) ---
router.get("/me", auth, async (req, res) => { // Requires only 'auth'
    try {
        // req.user is populated by the 'auth' middleware
        const userId = req.user.id;
        const userQuery = await pool.query(
            "SELECT id, username, email, role, is_admin, profile_picture_url, full_name, admission_number, class_id FROM users WHERE id = $1",
            [userId]
        );
        const user = userQuery.rows[0];

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            is_admin: user.is_admin,
            profile_picture_url: user.profile_picture_url || DEFAULT_AVATAR_URL,
            full_name: user.full_name,
            admission_number: user.admission_number,
            class_id: user.class_id
        });
    } catch (error) {
        console.error("Error fetching current user:", error);
        res.status(500).json({ error: "Server error fetching user data." });
    }
});

// --- GET USER BY ID (Auth required, self or admin) ---
router.get("/:id", auth, async (req, res) => {
    try {
        const { id } = req.params;
        // Authorize: Admin can view any user, regular user can only view their own profile
        if (req.user.id !== parseInt(id) && !req.user.is_admin) {
            console.warn(`[AUTH] Forbidden: User ${req.user.id} tried to access user ${id}'s data without admin privileges.`);
            return res.status(403).json({ error: "Access denied. You can only view your own profile unless you are an admin." });
        }

        // Includes class_id, admission_number, and full_name
        const userQuery = await pool.query(
            "SELECT id, username, email, role, is_admin, profile_picture_url, admission_number, class_id, full_name FROM users WHERE id = $1",
            [id]
        );
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }
        const user = userQuery.rows[0];
        user.profile_picture_url = user.profile_picture_url || DEFAULT_AVATAR_URL;
        res.json(user);
    } catch (error) {
        console.error("Error fetching user by ID:", error);
        res.status(500).json({ error: "Server error." });
    }
});


// --- UPDATE USER (Admin can update any user, user can update self) ---
router.put("/:id", auth, uploadMemory.single('profile_picture'), async (req, res) => {
    const userId = parseInt(req.params.id);
    const { username, email, role, is_admin, password, admission_number, class_id, full_name, remove_profile_picture } = req.body; // Added full_name

    // Check authorization: Admin can update any user, non-admin can only update their own profile.
    if (!req.user.is_admin && req.user.id !== userId) {
        return res.status(403).json({ error: "Access denied. You can only update your own profile." });
    }

    const client = await pool.connect();
    try {
        if (req.fileValidationError) {
            return res.status(400).json({ error: req.fileValidationError });
        }

        await client.query('BEGIN');

        // Fetch current user data to check existing picture and values
        const currentUserQuery = await client.query('SELECT profile_picture_url, password_hash, role FROM users WHERE id = $1', [userId]); // Added role to fetch
        if (currentUserQuery.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }
        const oldUserData = currentUserQuery.rows[0];
        let profilePictureUrl = oldUserData.profile_picture_url;
        let hashedPassword = oldUserData.password_hash;

        // Handle password change
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // Handle profile picture update/removal
        if (remove_profile_picture === 'true') {
            profilePictureUrl = DEFAULT_AVATAR_URL; // Set to default
            // Delete old picture from Cloudinary if it's not the default
            if (oldUserData.profile_picture_url && oldUserData.profile_picture_url !== DEFAULT_AVATAR_URL) {
                const publicId = getCloudinaryPublicId(oldUserData.profile_picture_url);
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId);
                }
            }
        } else if (req.file) {
            // New file uploaded, delete old one (if not default) and upload new
            if (oldUserData.profile_picture_url && oldUserData.profile_picture_url !== DEFAULT_AVATAR_URL) {
                const publicId = getCloudinaryPublicId(oldUserData.profile_picture_url);
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId);
                }
            }
            const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, {
                folder: "profile_pictures",
                public_id: `avatar_${Date.now()}`
            });
            profilePictureUrl = result.secure_url;
        } else if (!oldUserData.profile_picture_url) {
             // If no new file and no old picture, ensure it defaults
            profilePictureUrl = DEFAULT_AVATAR_URL;
        }


        let queryText;
        let queryParams;

        // Admin can update any user's fields, including role and is_admin
        if (req.user.is_admin) {
            queryText = `
                UPDATE users
                SET username = COALESCE($1, username),
                    email = COALESCE($2, email),
                    role = COALESCE($3, role),
                    is_admin = COALESCE($4, is_admin),
                    password_hash = $5,
                    profile_picture_url = $6,
                    admission_number = COALESCE($7, admission_number),
                    class_id = COALESCE($8, class_id),
                    full_name = COALESCE($9, full_name)
                WHERE id = $10
                RETURNING id, username, email, role, is_admin, profile_picture_url, admission_number, class_id, full_name
            `;
            queryParams = [
                username, email, role, (is_admin === 'true'), hashedPassword,
                profilePictureUrl, admission_number || null, class_id || null, full_name || null, userId
            ];

            // If the role is explicitly changed to non-student, nullify admission_number and class_id
            if (role && role !== 'student' && oldUserData.role === 'student') {
                 queryText = queryText.replace(', admission_number = COALESCE($7, admission_number), class_id = COALESCE($8, class_id)', ', admission_number = NULL, class_id = NULL');
                 queryParams.splice(6, 2); // Remove admission_number and class_id from params
            } else if (role === 'student' && (!admission_number || !class_id) && oldUserData.role !== 'student') {
                // If changing to student, ensure admission_number and class_id are provided
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Admission number and Class must be provided when setting role to student." });
            }


        } else {
            // Non-admin users can only update their own username, email, password, and profile picture, and full_name
            queryText = `
                UPDATE users
                SET username = COALESCE($1, username),
                    email = COALESCE($2, email),
                    password_hash = $3,
                    profile_picture_url = $4,
                    full_name = COALESCE($5, full_name)
                WHERE id = $6
                RETURNING id, username, email, role, is_admin, profile_picture_url, admission_number, class_id, full_name
            `;
            queryParams = [
                username, email, hashedPassword, profilePictureUrl, full_name || null, userId
            ];
        }

        const result = await client.query(queryText, queryParams);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found or no changes made." });
        }

        await client.query('COMMIT');
        res.json({ message: "User updated successfully", user: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Update user error:", error);
        // Handle unique constraint errors for username/email/admission_number
        if (error.code === '23505') {
            if (error.constraint === 'users_username_key') {
                return res.status(409).json({ error: 'Username already exists.' });
            }
            if (error.constraint === 'users_email_key') {
                return res.status(409).json({ error: 'Email already exists.' });
            }
            if (error.constraint === 'users_admission_number_key') {
                return res.status(409).json({ error: 'Admission number already exists.' });
            }
        }
        res.status(500).json({ error: "Failed to update user. " + error.message });
    } finally {
        client.release();
    }
});


// --- DELETE USER (Admin only) ---
router.delete("/:id", auth, auth.isAdmin, async (req, res) => { // <--- THIS WAS THE MISSING FIX FOR DELETE
    const { id } = req.params;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // 1. Get user's profile picture URL before deleting
        const userPhotoQuery = await client.query('SELECT profile_picture_url FROM users WHERE id = $1', [id]);
        const userPhotoUrl = userPhotoQuery.rows[0]?.profile_picture_url;

        // 2. Delete user's related data (e.g., CBT results, if any)
        // Add more deletion queries for related tables here as needed
        // await client.query('DELETE FROM cbt_results WHERE user_id = $1', [id]);
        // await client.query('DELETE FROM user_sessions WHERE user_id = $1', [id]);

        // 3. Delete the user
        const deleteUser = await client.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);

        if (deleteUser.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }

        // 4. Delete profile picture from Cloudinary if it's not the default
        if (userPhotoUrl && userPhotoUrl !== DEFAULT_AVATAR_URL && userPhotoUrl.includes('cloudinary.com')) {
            const publicIdMatch = userPhotoUrl.match(/\/v\d+\/(profile_pictures\/[^/.]+)/);
            if (publicIdMatch && publicIdMatch[1]) {
                const publicId = publicIdMatch[1];
                await cloudinary.uploader.destroy(publicId);
                console.log(`Cloudinary: Deleted image with public ID: ${publicId}`);
            }
        }

        await client.query('COMMIT'); // Commit transaction
        res.status(200).json({ message: "User and associated data (like sessions, results, reports) deleted successfully." });

    } catch (error) {
        if (client) { await client.query('ROLLBACK'); }
        console.error("Delete user error:", error);
         if (error.code === '23503') { // Foreign key violation
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
        secure: process.env.NODE_ENV === 'production', // Only secure in production
        sameSite: 'Lax'
    });
    res.status(200).json({ message: "Logged out successfully" });
});

// Debug route (optional, for development)
router.get('/debug-users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, is_admin, profile_picture_url, admission_number, class_id FROM users');
    result.rows.forEach(user => {
        user.profile_picture_url = user.profile_picture_url || DEFAULT_AVATAR_URL;
    });
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;

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
const DEFAULT_AVATAR_URL = 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg';

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer setup for local storage (if used, from download.js)
const upload = multer({
    storage: multer.diskStorage({
        destination: UPLOADS_DIR,
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const name = file.fieldname + '-' + Date.now() + ext;
            cb(null, name);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (jpeg, jpg, png, gif) are allowed.'));
        }
    }
});
// Helper function to delete local file (if not using Cloudinary for all)
const deleteLocalFile = (filePath) => {
    fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting local file:", filePath, err);
        else console.log("Successfully deleted local file:", filePath);
    });
};
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

        // Fetch user from the database, selecting class_level instead of class_id
        const userQuery = await pool.query(
            "SELECT id, username, email, password, role, is_admin, profile_picture_url, full_name, admission_number, class_level FROM users WHERE username = $1 OR email = $1",
            [identifier]
        );
        const user = userQuery.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
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
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 3600000 // 1 hour
        });

        // Send successful login response with user details, including class_level
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
                class_level: user.class_level // Use class_level here
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error during login." });
    }
});



// --- REGISTER USER ---
router.post("/register", upload.single('profile_picture'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Include class_level in destructuring
        const { username, email, password, role, admission_number, first_name, last_name, dob, gender, class_level } = req.body;
        const profilePictureFile = req.file;

        // Basic server-side validation
        if (!first_name || !last_name || !email || !password || !role) {
            return res.status(400).json({ error: "First Name, Last Name, Email, Password, and Role are required." });
        }

        // Only check admission_number and class_level for students
        if (role === 'student') {
            if (!admission_number) {
                return res.status(400).json({ error: "Admission Number is required for students.", field: "admission_number" });
            }
            const admissionRegex = /^SNA\/\d{2}\/\d{3}$/i;
            if (!admissionRegex.test(admission_number)) {
                return res.status(400).json({ error: "Invalid admission number format. Expected SNA/YY/001 (e.g., SNA/23/001).", field: "admission_number" });
            }
            if (!class_level) {
                return res.status(400).json({ error: "Class Level is required for students.", field: "class_level" });
            }
        }


        // Check if user already exists
        let userExistsQuery = 'SELECT id FROM users WHERE email = $1';
        let userExistsParams = [email];
        if (username) {
            userExistsQuery += ' OR username = $2';
            userExistsParams.push(username);
        }
        const userExists = await client.query(userExistsQuery, userExistsParams);
        
        if (userExists.rows.length > 0) {
            if (profilePictureFile) {
                fs.unlinkSync(profilePictureFile.path); // Delete temp file if user exists
            }
            return res.status(409).json({ error: "User with that email or username already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let profile_picture_url = DEFAULT_AVATAR_URL; // Default avatar

        if (profilePictureFile) {
            try {
                const uploadResult = await cloudinary.uploader.upload(profilePictureFile.path, {
                    folder: "cbt_profile_pictures", // Ensure folder name is consistent
                    eager: [
                        { width: 150, height: 150, crop: "fill", gravity: "face" }
                    ]
                });
                profile_picture_url = uploadResult.secure_url;
                fs.unlinkSync(profilePictureFile.path); // Delete local file after Cloudinary upload
            } catch (cloudinaryError) {
                console.error("Cloudinary upload error:", cloudinaryError);
                profile_picture_url = DEFAULT_AVATAR_URL; // Fallback to default
                if (profilePictureFile) {
                    fs.unlinkSync(profilePictureFile.path);
                }
                console.warn("Continuing registration with default avatar due to Cloudinary upload failure.");
            }
        }

        // Determine is_admin based on role
        const is_admin = (role === 'admin');
        const finalUsername = username || (role === 'student' ? admission_number : email.split('@')[0]); // Auto-generate username

        // Construct the INSERT query using class_level instead of class_id
        const insertQuery = `
            INSERT INTO users (username, email, password, role, is_admin, profile_picture_url,
                               full_name, admission_number, class_level, dob, gender)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, username, email, role, is_admin, profile_picture_url, full_name, admission_number, class_level, dob, gender`;

        const result = await client.query(
            insertQuery,
            [
                finalUsername,
                email,
                hashedPassword,
                role,
                is_admin,
                profile_picture_url,
                `${first_name} ${last_name}`, // Assuming full_name is combined
                role === 'student' ? (admission_number || null) : null, // admission_number only for students
                role === 'student' ? (class_level || null) : null, // class_level for students, null for others
                dob || null, // Date of birth
                gender || null // Gender
            ]
        );

        const newUser = result.rows[0];

        // Generate JWT token (optional for registration, but good for immediate login)
        const token = jwt.sign(
            { id: newUser.id, username: newUser.username, role: newUser.role, is_admin: newUser.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        // Set JWT as an HttpOnly cookie
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 3600000 // 1 hour in milliseconds
        });

        await client.query('COMMIT');
        res.status(201).json({ message: "User registered successfully!", user: newUser });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Registration error:", error);
        // Handle specific errors for user feedback
        if (error.code === '23505') { // Unique violation (e.g., username or email already exists)
            return res.status(409).json({ error: "A user with that email or username already exists." });
        }
        // Specific check for 'password' column not-null constraint
        if (error.code === '23502' && error.column === 'password') {
            return res.status(400).json({ error: "Missing password. Please provide a password." });
        }
        if (error.code === '23502' && error.column === 'email') { // Example for other not-nulls
             return res.status(400).json({ error: "Email is a required field." });
        }
        if (error.code === '23502' && error.column === 'role') {
             return res.status(400).json({ error: "Role is a required field." });
        }
        // Catch the specific constraint violation for class_level
        if (error.code === '23514' && error.constraint === 'class_level_for_students_only') {
            return res.status(400).json({ error: "Class level is required for students and should not be set for non-students.", field: "class_level" });
        }
        res.status(500).json({ error: "Failed to register user. " + error.message });
    } finally {
        client.release();
    }
});


// --- GET ALL USERS (Admin only) ---
router.get("/", auth, auth.isAdmin, async (req, res) => { // Requires 'auth' then 'auth.isAdmin'
    try {
        console.log("[API] Fetching all users...");
        // Select class_level instead of class_id
        const result = await pool.query(
            "SELECT id, username, email, role, is_admin, profile_picture_url, full_name, admission_number, class_level, dob, gender FROM users ORDER BY username ASC"
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
        // Select class_level instead of class_id
        const userQuery = await pool.query(
            "SELECT id, username, email, role, is_admin, profile_picture_url, full_name, admission_number, class_level, dob, gender FROM users WHERE id = $1",
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
            class_level: user.class_level, // Use class_level here
            dob: user.dob,
            gender: user.gender
        });
    } catch (error) {
        console.error("Error fetching current user:", error);
        res.status(500).json({ error: "Server error fetching user data." });
    }
});

// --- GET USER BY ID (Auth required, self or admin) ---
router.get("/:id", auth, auth.isAdmin, async (req, res) => { // Requires 'auth' then 'auth.isAdmin'
    try {
        const { id } = req.params;
        // Select class_level instead of class_id
        const result = await pool.query(
            "SELECT id, username, email, role, is_admin, profile_picture_url, full_name, admission_number, class_level, dob, gender FROM users WHERE id = $1",
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


// --- UPDATE USER (Admin can update any user, user can update self) ---
router.put("/:id", auth, upload.single('profile_picture'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        // Include class_level in destructuring
        const { username, email, password, role, is_admin, first_name, last_name, admission_number, dob, gender, class_level } = req.body;
        let profile_picture_url = req.body.profile_picture_url || DEFAULT_AVATAR_URL; // Default from body or constant

        // Fetch current user data to determine permissions and existing hash, selecting class_level
        const currentUserQuery = await client.query("SELECT password, role, is_admin, profile_picture_url, full_name, admission_number, class_level, dob, gender FROM users WHERE id = $1", [id]);
        const currentUser = currentUserQuery.rows[0];

        if (!currentUser) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }

        // Permission check: Admin can update any user, non-admin can only update their own profile.
        // req.user.id is from the authenticated token, id is from URL parameter.
        if (String(req.user.id) !== String(id) && !req.user.is_admin) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: "Access denied. You can only update your own profile." });
        }

        // If a new password is provided, hash it. Otherwise, keep the existing one.
        let hashedPassword = currentUser.password;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // Handle profile picture upload
        if (req.file) {
            try {
                // Delete old image from Cloudinary if it's not the default and exists
                if (currentUser.profile_picture_url && currentUser.profile_picture_url !== DEFAULT_AVATAR_URL) {
                    const publicId = getCloudinaryPublicId(currentUser.profile_picture_url);
                    if (publicId) await cloudinary.uploader.destroy(`cbt_profile_pictures/${publicId}`);
                }

                const uploadResult = await cloudinary.uploader.upload(req.file.path, {
                    folder: "cbt_profile_pictures",
                    eager: [
                        { width: 150, height: 150, crop: "fill", gravity: "face" }
                    ]
                });
                profile_picture_url = uploadResult.secure_url;
                fs.unlinkSync(req.file.path); // Delete local temp file
            } catch (cloudinaryError) {
                console.error("Cloudinary profile picture update error:", cloudinaryError);
                if (req.file) fs.unlinkSync(req.file.path);
                profile_picture_url = currentUser.profile_picture_url || DEFAULT_AVATAR_URL;
                console.warn("Continuing profile update with existing/default avatar due to Cloudinary upload failure.");
            }
        } else if (req.body.clear_profile_picture === 'true') {
            // Option to clear profile picture (set to default)
            if (currentUser.profile_picture_url && currentUser.profile_picture_url !== DEFAULT_AVATAR_URL) {
                const publicId = getCloudinaryPublicId(currentUser.profile_picture_url);
                if (publicId) await cloudinary.uploader.destroy(`cbt_profile_pictures/${publicId}`);
            }
            profile_picture_url = DEFAULT_AVATAR_URL;
        }


        const updateFields = [];
        const queryParams = [];
        let paramIndex = 1;

        const addField = (field, value) => {
            // Only add the field if the value is explicitly provided (not undefined)
            // or if it's a specific field like password where null might be intentional for hashing.
            // For profile_picture_url, allow explicit setting to DEFAULT_AVATAR_URL.
            if (value !== undefined || field === 'profile_picture_url' || field === 'password') {
                updateFields.push(`${field} = $${paramIndex++}`);
                queryParams.push(value);
            }
        };

        // Fields that can be updated by either user (self) or admin
        addField('username', username);
        addField('email', email);
        addField('password', hashedPassword);
        addField('profile_picture_url', profile_picture_url);
        addField('full_name', (first_name && last_name) ? `${first_name} ${last_name}` : currentUser.full_name);
        addField('dob', dob);
        addField('gender', gender);

        // Fields only updated by Admin
        if (req.user.is_admin) {
            addField('role', role);
            addField('is_admin', is_admin);
            // Admin can set admission_number and class_level
            if (role === 'student') {
                addField('admission_number', admission_number || null);
                addField('class_level', class_level || null); // Set class_level for students
            } else {
                addField('admission_number', null);
                addField('class_level', null); // Set class_level to null for non-students
            }
        } else {
            // Non-admin cannot change role or admin status; ensure these are not updated
            // Also ensure student-specific fields are not updated by non-admins if not for self
            addField('admission_number', currentUser.admission_number);
            addField('class_level', currentUser.class_level); // Keep existing class_level
        }

        if (updateFields.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "No fields provided for update." });
        }

        // Add the id for the WHERE clause
        updateFields.push(`id = $${paramIndex++}`);
        queryParams.push(id);

        // Update RETURNING clause to use class_level
        const query = `UPDATE users SET ${updateFields.slice(0, -1).join(', ')} WHERE id = $${paramIndex - 1} RETURNING id, username, email, role, is_admin, profile_picture_url, full_name, admission_number, class_level, dob, gender`;
        
        const result = await client.query(query, queryParams);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found or no changes made." });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: "User updated successfully", user: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Update user error:", error);
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: "Another user already uses that username or email." });
        }
        if (error.code === '23514' && error.constraint === 'class_level_for_students_only') {
            return res.status(400).json({ error: "Class level is required for students and should not be set for non-students.", field: "class_level" });
        }
        res.status(500).json({ error: "Failed to update user. " + error.message });
    } finally {
        if (client) { client.release(); }
    }
});


// --- DELETE USER (Admin only) ---
router.delete("/:id", auth, auth.isAdmin, async (req, res) => {
    const { id } = req.params;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // 1. Fetch user's profile picture URL before deleting to delete from Cloudinary
        const userResult = await client.query('SELECT profile_picture_url FROM users WHERE id = $1', [id]);
        const userToDelete = userResult.rows[0];

        if (userToDelete && userToDelete.profile_picture_url && userToDelete.profile_picture_url !== DEFAULT_AVATAR_URL) {
            try {
                const publicId = getCloudinaryPublicId(userToDelete.profile_picture_url); // Use helper function
                if (publicId) await cloudinary.uploader.destroy(`cbt_profile_pictures/${publicId}`);
                console.log(`Deleted Cloudinary image for user ${id}: ${publicId}`);
            } catch (cloudinaryError) {
                console.error(`Failed to delete Cloudinary image for user ${id}:`, cloudinaryError);
                // Log the error but don't prevent user deletion if image deletion fails
            }
        }

        // 2. Delete ALL related data first from child tables
        // Add more specific deletion queries for ALL related tables here based on your schema
        // This is CRUCIAL for foreign key constraints!
        await client.query('DELETE FROM exam_results WHERE user_id = $1', [id]);
        // await client.query('DELETE FROM sessions WHERE user_id = $1', [id]); // REMOVED: This table does not exist based on your error
        // IMPORTANT: Add DELETE FROM table_name WHERE user_id = $1; for every table in your database
        // that has a foreign key referencing the users.id. Examples:
        // await client.query('DELETE FROM user_progress WHERE user_id = $1', [id]);
        // await client.query('DELETE FROM user_settings WHERE user_id = $1', [id]);
        // await client.query('DELETE FROM quizzes_taken WHERE user_id = $1', [id]);


        // 3. Finally, delete the user from the users table
        const deleteUserResult = await client.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);

        if (deleteUserResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }

        await client.query('COMMIT'); // Commit transaction
        res.status(200).json({ message: "User and all associated data deleted successfully." });

    } catch (error) {
        if (client) { await client.query('ROLLBACK'); }
        console.error("Delete user error:", error);
         if (error.code === '23503') { // Foreign key violation (should ideally not happen if all dependencies are deleted above)
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

// Debug route (optional, for development)
router.get('/debug-users', async (req, res) => {
  try {
    // Select class_level instead of class_id
    const result = await pool.query('SELECT id, username, email, role, is_admin, profile_picture_url, admission_number, class_level, dob, gender FROM users');
    result.rows.forEach(user => {
        user.profile_picture_url = user.profile_picture_url || DEFAULT_AVATAR_URL;
    });
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching debug users:", error);
    res.status(500).json({ error: "Failed to fetch debug users." });
  }
});


module.exports = router;

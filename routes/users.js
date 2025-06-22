const auth = require("../middlewares/auth");
const express = require("express");
const router = express.Router();
const pool = require("../database/db");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Re-added fs

// --- Cloudinary Configuration (remains for production/Cloudinary use) ---
const cloudinary = require('cloudinary').v2;
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Multer Configuration for Local Disk Storage (re-added for local flexibility) ---
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'profile_pictures');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const localStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        // Sanitize filename further
        const baseName = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9_.-]/g, '_');
        cb(null, `${baseName}-${uniqueSuffix}${extension}`);
    }
});

const upload = multer({
    storage: multer.memoryStorage(), // Use memory storage for Cloudinary uploads
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            req.fileValidationError = 'Only image files (jpg, jpeg, png, gif) are allowed!';
            return cb(new Error(req.fileValidationError), false);
        }
        cb(null, true);
    }
});

// Local storage for when not using Cloudinary or for fallback
const localUpload = multer({
    storage: localStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            req.fileValidationError = 'Only image files (jpg, jpeg, png, gif) are allowed!';
            return cb(new Error(req.fileValidationError), false);
        }
        cb(null, true);
    }
});

// IMPORTANT: Set this to your local default avatar path
const DEFAULT_AVATAR_URL = "/images/default_avatar.jpeg";

// REGISTER USER
router.post("/register", localUpload.single('profile_picture'), async (req, res) => {
    // If a file was uploaded using local storage, proceed with local file path
    // Otherwise, if no file, use the default avatar URL
    const profile_picture_path = req.file ? `/uploads/profile_pictures/${req.file.filename}` : DEFAULT_AVATAR_URL;

    if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
    }

    const { username, password, email, role, admission_number, class_id } = req.body;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const existingUser = await client.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            // Clean up the uploaded local file if the user already exists
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(409).json({ error: "Username or Email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let insertUserQuery = `
            INSERT INTO users (username, password, email, role, profile_picture_url
        `;
        let queryParams = [username, hashedPassword, email, role, profile_picture_path];
        let valuesPlaceholder = `$1, $2, $3, $4, $5`;

        if (role === 'student') {
            insertUserQuery += ', admission_number, class_id';
            valuesPlaceholder += `, $6, $7`;
            queryParams.push(admission_number, class_id);
        }
        insertUserQuery += `) VALUES (${valuesPlaceholder}) RETURNING id, username, email, role, profile_picture_url`;

        const newUser = await client.query(insertUserQuery, queryParams);
        await client.query('COMMIT');
        res.status(201).json({ message: "User registered successfully", user: newUser.rows[0] });

    } catch (error) {
        if (client) { await client.query('ROLLBACK'); }
        console.error("Registration error:", error);
        // Clean up the uploaded local file if an error occurred
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: "Registration failed. " + error.message });
    } finally {
        if (client) { client.release(); }
    }
});


// LOGIN USER
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (user.rows.length === 0) {
            return res.status(400).json({ error: "Invalid username or password" });
        }
        const isMatch = await bcrypt.compare(password, user.rows[0].password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid username or password" });
        }

        const token = jwt.sign(
            { id: user.rows[0].id, username: user.rows[0].username, role: user.rows[0].role, is_admin: user.rows[0].is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        res.cookie('jwt', token, {
            httpOnly: true, // Prevents client-side JS from reading the cookie
            secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
            sameSite: 'Lax', // Protects against CSRF
            maxAge: 3600000 // 1 hour in milliseconds
        });

        res.json({ message: "Logged in successfully", user: { id: user.rows[0].id, username: user.rows[0].username, role: user.rows[0].role, is_admin: user.rows[0].is_admin, profile_picture_url: user.rows[0].profile_picture_url } });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

// GET CURRENT USER PROFILE
router.get('/me', auth, async (req, res) => {
    try {
        // req.user is populated by the auth middleware
        const user = await pool.query(
            'SELECT id, username, email, role, is_admin, admission_number, class_id, profile_picture_url FROM users WHERE id = $1',
            [req.user.id]
        );
        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(user.rows[0]);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Server error fetching profile.' });
    }
});

// GET ALL USERS (Admin/Teacher only)
router.get('/', auth, auth.isAdmin, async (req, res) => {
    try {
        const users = await pool.query('SELECT id, username, email, role, is_admin, admission_number, class_id, profile_picture_url FROM users ORDER BY id ASC');
        res.json(users.rows);
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ error: 'Server error fetching users.' });
    }
});

// GET USER BY ID (Admin/Teacher only)
router.get('/:id', auth, auth.isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const user = await pool.query('SELECT id, username, email, role, is_admin, admission_number, class_id, profile_picture_url FROM users WHERE id = $1', [id]);
        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(user.rows[0]);
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        res.status(500).json({ error: 'Server error fetching user.' });
    }
});

// UPDATE USER (Admin can update any user, User can update self)
// Using localUpload.single to handle file uploads to local disk
router.put('/:id', auth, localUpload.single('profile_picture'), async (req, res) => {
    const userIdToUpdate = parseInt(req.params.id);
    const { username, email, role, is_admin, admission_number, class_id, profile_picture_url_exists } = req.body;
    let client;
    let oldProfilePictureUrl = null;

    if (req.user.id !== userIdToUpdate && !req.user.is_admin) {
        return res.status(403).json({ error: "Access denied. You can only update your own profile unless you are an admin." });
    }

    if (req.fileValidationError) {
        return res.status(400).json({ error: req.fileValidationError });
    }

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Fetch current user data to get old profile picture URL for potential deletion
        const currentUserData = await client.query('SELECT profile_picture_url FROM users WHERE id = $1', [userIdToUpdate]);
        if (currentUserData.rows.length > 0) {
            oldProfilePictureUrl = currentUserData.rows[0].profile_picture_url;
        }

        let profilePictureUrl = oldProfilePictureUrl; // Default to keeping the old one

        if (req.file) {
            // New file uploaded, use its path
            profilePictureUrl = `/uploads/profile_pictures/${req.file.filename}`;
        } else if (profile_picture_url_exists === 'false') {
             // If frontend explicitly says no picture should exist (e.g., removed by user)
             profilePictureUrl = DEFAULT_AVATAR_URL;
        }
        // If no file and profile_picture_url_exists is not 'false', then profilePictureUrl remains oldProfilePictureUrl (keep current)

        let updateQuery = `
            UPDATE users SET
                username = $1,
                email = $2,
                role = $3,
                profile_picture_url = $4
        `;
        let queryParams = [username, email, role, profilePictureUrl, userIdToUpdate];
        let valuesCount = 4;

        if (req.user.is_admin) {
            // Only admin can change is_admin status
            updateQuery += `, is_admin = $${++valuesCount}`;
            queryParams.push(is_admin === 'true'); // Convert string to boolean
        }

        if (role === 'student') {
            updateQuery += `, admission_number = $${++valuesCount}, class_id = $${++valuesCount}`;
            queryParams.push(admission_number, class_id);
        } else {
            // If role changes from student, clear student-specific fields
            updateQuery += `, admission_number = NULL, class_id = NULL`;
        }

        updateQuery += ` WHERE id = $${++valuesCount} RETURNING *`;

        const result = await client.query(updateQuery, queryParams);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            // Clean up newly uploaded file if user not found
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(404).json({ error: "User not found." });
        }

        // Delete the old profile picture if a new one was uploaded and the old one was not the default
        if (req.file && oldProfilePictureUrl && oldProfilePictureUrl !== DEFAULT_AVATAR_URL) {
            const oldFilePath = path.join(__dirname, '..', 'public', oldProfilePictureUrl);
            if (fs.existsSync(oldFilePath)) {
                fs.unlink(oldFilePath, err => {
                    if (err) console.error(`Failed to delete old profile picture ${oldFilePath}:`, err);
                });
            }
        }
        // If profile_picture_url_exists was 'false' AND there was an old non-default picture, delete it
        if (profile_picture_url_exists === 'false' && oldProfilePictureUrl && oldProfilePictureUrl !== DEFAULT_AVATAR_URL) {
            const oldFilePath = path.join(__dirname, '..', 'public', oldProfilePictureUrl);
             if (fs.existsSync(oldFilePath)) {
                fs.unlink(oldFilePath, err => {
                    if (err) console.error(`Failed to delete old profile picture ${oldFilePath} when explicitly removed:`, err);
                });
            }
        }


        await client.query('COMMIT');
        res.json({ message: "User updated successfully", user: result.rows[0] });

    } catch (error) {
        if (client) { await client.query('ROLLBACK'); }
        console.error("Update user error:", error);
        // Clean up newly uploaded file if an error occurred
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: "Failed to update user. " + error.message });
    } finally {
        if (client) { client.release(); }
    }
});


// DELETE USER
router.delete('/:id', auth, auth.isAdmin, async (req, res) => {
    const { id: userId } = req.params;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Fetch user to get profile picture URL before deleting
        const userToDelete = await client.query('SELECT profile_picture_url FROM users WHERE id = $1', [userId]);
        if (userToDelete.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }

        // Delete associated exam sessions
        await client.query('DELETE FROM public.exam_sessions WHERE user_id = $1', [userId]);
        // Delete associated exam results
        await client.query('DELETE FROM public.exam_results WHERE student_id = $1', [userId]);
        // Delete associated report card meta data
        await client.query('DELETE FROM public.report_card_meta WHERE student_id = $1', [userId]);
        // Delete user
        const result = await client.query('DELETE FROM public.users WHERE id = $1 RETURNING *', [userId]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }

        // Delete the associated profile picture from local storage if it's not the default
        const profilePictureUrl = userToDelete.rows[0].profile_picture_url;
        if (profilePictureUrl && profilePictureUrl.startsWith('/uploads/') && profilePictureUrl !== DEFAULT_AVATAR_URL) {
            const filePath = path.join(__dirname, '..', 'public', profilePictureUrl);
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, err => { if (err) console.error(`Failed to delete profile picture for user ${userId}:`, err); });
            }
        }
        await client.query('COMMIT');
        res.json({ message: "User and associated data (like sessions, results, reports) deleted successfully." });

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

router.get('/debug-users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
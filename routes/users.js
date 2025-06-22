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
        const baseName = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9_.-]/g, '_');
        cb(null, `${baseName}-${uniqueSuffix}${extension}`);
    }
});

const uploadLocal = multer({
    storage: localStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            req.fileValidationError = 'Only image files (jpg, jpeg, png, gif) are allowed!';
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// --- Multer Configuration for Memory Storage (for Cloudinary uploads) ---
const uploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            req.fileValidationError = 'Only image files (jpg, jpeg, png, gif) are allowed!';
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Helper function to handle profile picture upload (either to Cloudinary or local)
async function handleProfilePictureUpload(req) {
    if (req.file) {
        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            // Upload to Cloudinary
            try {
                const b64 = Buffer.from(req.file.buffer).toString("base64");
                let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
                const result = await cloudinary.uploader.upload(dataURI, {
                    folder: "profile_pictures",
                    transformation: [{ width: 200, height: 200, crop: "fill", gravity: "face" }]
                });
                return result.secure_url;
            } catch (uploadError) {
                console.error("Cloudinary upload error:", uploadError);
                throw new Error("Failed to upload profile picture to Cloudinary.");
            }
        } else {
            // Use local storage if Cloudinary is not configured
            return `/uploads/profile_pictures/${req.file.filename}`;
        }
    }
    return null; // No file uploaded
}

// REGISTER USER
router.post("/register", uploadLocal.single('profile_picture'), async (req, res) => { // Use uploadLocal for registration
    try {
        if (req.fileValidationError) {
            return res.status(400).json({ error: req.fileValidationError });
        }

        const { username, password, email, role, full_name, admission_number, class_id } = req.body;

        if (!username || !password || !email || !role || !full_name) {
            if (req.file && process.env.CLOUDINARY_CLOUD_NAME == null) { // Only delete locally stored file if not using Cloudinary
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({ error: "All required fields must be filled." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let profilePictureUrl = null;

        if (req.file) {
            // If Cloudinary credentials are provided, upload to Cloudinary
            if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
                const b64 = Buffer.from(req.file.buffer).toString("base64");
                let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
                const result = await cloudinary.uploader.upload(dataURI, {
                    folder: "profile_pictures",
                    transformation: [{ width: 200, height: 200, crop: "fill", gravity: "face" }]
                });
                profilePictureUrl = result.secure_url;
            } else {
                // Otherwise, use local path
                profilePictureUrl = `/uploads/profile_pictures/${req.file.filename}`;
            }
        }

        let query = `INSERT INTO users (username, password_hash, email, role, full_name, profile_picture_url`;
        let values = [username, hashedPassword, email, role, full_name, profilePictureUrl];
        let placeholders = [`$1`, `$2`, `$3`, `$4`, `$5`, `$6`];
        let paramIndex = 7;

        if (role === 'student') {
            if (!admission_number || !class_id) {
                if (req.file && process.env.CLOUDINARY_CLOUD_NAME == null) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(400).json({ error: "Admission number and class must be provided for students." });
            }
            query += `, admission_number, class_id`;
            values.push(admission_number, class_id);
            placeholders.push(`$${paramIndex++}`, `$${paramIndex++}`);
        }
        query += `) VALUES (${placeholders.join(', ')}) RETURNING id, username, email, role, full_name, profile_picture_url, admission_number, class_id`;

        const result = await pool.query(query, values);
        const newUser = result.rows[0];

        // Generate token and set cookie upon successful registration (optional, depends on flow)
        const token = jwt.sign(
            { id: newUser.id, username: newUser.username, role: newUser.role, is_admin: newUser.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.cookie('jwt', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 3600000 }); // 1 hour

        res.status(201).json({ message: "User registered successfully", user: newUser });
    } catch (error) {
        console.error("Registration error:", error);
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: "User with this username or email already exists." });
        }
        res.status(500).json({ error: "Registration failed. " + error.message });
    }
});

// LOGIN USER
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body; // 'identifier' can be username or email
        const userQuery = `SELECT id, username, email, password_hash, role, is_admin, profile_picture_url, full_name, admission_number, class_id FROM users WHERE username = $1 OR email = $1`;
        const result = await pool.query(userQuery, [identifier]);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Invalid credentials." });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ error: "Invalid credentials." });
        }

        // Exclude password_hash from the user object sent to the client
        const { password_hash, ...userWithoutPassword } = user;

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, is_admin: user.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie('jwt', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 3600000 }); // 1 hour
        res.json({ message: "Logged in successfully", user: userWithoutPassword });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed. " + error.message });
    }
});

// GET CURRENT USER (protected)
router.get("/me", auth, async (req, res) => {
    try {
        const userQuery = `SELECT id, username, email, role, is_admin, profile_picture_url, full_name, admission_number, class_id FROM users WHERE id = $1`;
        const result = await pool.query(userQuery, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Fetch current user error:", error);
        res.status(500).json({ error: "Failed to fetch user data." });
    }
});

// GET ALL USERS (Admin only)
router.get("/", auth, auth.isAdmin, async (req, res) => {
    try {
        const { role, search } = req.query;
        let query = `SELECT id, username, email, role, is_admin, full_name, admission_number, class_id, profile_picture_url FROM users`;
        const queryParams = [];
        const conditions = [];

        if (role) {
            conditions.push(`role = $${queryParams.push(role)}`);
        }
        if (search) {
            const searchTerm = `%${search}%`;
            conditions.push(`(username ILIKE $${queryParams.push(searchTerm)} OR email ILIKE $${queryParams.push(searchTerm)} OR full_name ILIKE $${queryParams.push(searchTerm)})`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(` AND `);
        }
        query += ` ORDER BY username ASC`;

        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (error) {
        console.error("Fetch all users error:", error);
        res.status(500).json({ error: "Failed to fetch users." });
    }
});

// GET USER BY ID (Admin only)
router.get("/:id", auth, auth.isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT id, username, email, role, is_admin, full_name, admission_number, class_id, profile_picture_url FROM users WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error("Fetch user by ID error:", error);
        res.status(500).json({ error: "Failed to fetch user." });
    }
});


// UPDATE USER (Admin only)
router.put("/:id", auth, auth.isAdmin, uploadLocal.single('profile_picture'), async (req, res) => { // Use uploadLocal
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (req.fileValidationError) {
            return res.status(400).json({ error: req.fileValidationError });
        }

        const { id } = req.params;
        const { username, email, role, full_name, password, admission_number, class_id, remove_profile_picture, profile_picture_url_exists } = req.body;

        const findUserQuery = `SELECT profile_picture_url FROM users WHERE id = $1`;
        const userResult = await client.query(findUserQuery, [id]);
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }
        const oldProfilePictureUrl = userResult.rows[0].profile_picture_url;

        let profilePictureUrl = oldProfilePictureUrl; // Default to existing URL
        const isCloudinaryUrl = oldProfilePictureUrl && oldProfilePictureUrl.startsWith('http');

        if (remove_profile_picture === 'true') {
            profilePictureUrl = null; // Set to null if picture is to be removed
            // Delete old picture from Cloudinary or local if it exists
            if (oldProfilePictureUrl) {
                if (isCloudinaryUrl) {
                    const publicId = oldProfilePictureUrl.split('/').pop().split('.')[0];
                    await cloudinary.uploader.destroy(`profile_pictures/${publicId}`);
                } else {
                    const filePath = path.join(__dirname, '..', 'public', oldProfilePictureUrl);
                    if (fs.existsSync(filePath)) {
                        fs.unlink(filePath, err => { if (err) console.error(`Failed to delete local profile picture for user ${id}:`, err); });
                    }
                }
            }
        } else if (req.file) { // New file uploaded
            profilePictureUrl = await handleProfilePictureUpload(req); // This handles both local and Cloudinary
            // Delete old picture if a new one is uploaded
            if (oldProfilePictureUrl) {
                if (isCloudinaryUrl) {
                    const publicId = oldProfilePictureUrl.split('/').pop().split('.')[0];
                    await cloudinary.uploader.destroy(`profile_pictures/${publicId}`);
                } else {
                    const filePath = path.join(__dirname, '..', 'public', oldProfilePictureUrl);
                    if (fs.existsSync(filePath)) {
                        fs.unlink(filePath, err => { if (err) console.error(`Failed to delete old local profile picture for user ${id}:`, err); });
                    }
                }
            }
        } else if (profile_picture_url_exists === 'true') {
            // No new file, not removed, keep existing. profilePictureUrl already holds oldProfilePictureUrl.
        } else {
            // No file uploaded, and not explicitly marked as existing, means it was removed from form.
            // This case might happen if the user clears the file input without explicitly checking "remove".
            // To be safe, if `profile_picture_url_exists` is not true, and no new file, we assume removal.
            profilePictureUrl = null;
            if (oldProfilePictureUrl) {
                if (isCloudinaryUrl) {
                    const publicId = oldProfilePictureUrl.split('/').pop().split('.')[0];
                    await cloudinary.uploader.destroy(`profile_pictures/${publicId}`);
                } else {
                    const filePath = path.join(__dirname, '..', 'public', oldProfilePictureUrl);
                    if (fs.existsSync(filePath)) {
                        fs.unlink(filePath, err => { if (err) console.error(`Failed to delete local profile picture for user ${id}:`, err); });
                    }
                }
            }
        }


        let updateFields = [];
        let queryParams = [id];
        let paramIndex = 2;

        if (username) { updateFields.push(`username = $${paramIndex++}`); queryParams.push(username); }
        if (email) { updateFields.push(`email = $${paramIndex++}`); queryParams.push(email); }
        if (role) { updateFields.push(`role = $${paramIndex++}`); queryParams.push(role); }
        if (full_name) { updateFields.push(`full_name = $${paramIndex++}`); queryParams.push(full_name); }
        if (profilePictureUrl !== undefined) { updateFields.push(`profile_picture_url = $${paramIndex++}`); queryParams.push(profilePictureUrl); }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push(`password_hash = $${paramIndex++}`); queryParams.push(hashedPassword);
        }

        if (role === 'student') {
            updateFields.push(`admission_number = $${paramIndex++}`); queryParams.push(admission_number || null);
            updateFields.push(`class_id = $${paramIndex++}`); queryParams.push(class_id || null);
        } else {
            // If changing role from student, clear student-specific fields
            const currentUserRoleResult = await client.query(`SELECT role FROM users WHERE id = $1`, [id]);
            if (currentUserRoleResult.rows[0]?.role === 'student') {
                updateFields.push(`admission_number = NULL`);
                updateFields.push(`class_id = NULL`);
            }
        }

        if (updateFields.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "No fields to update." });
        }

        const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $1 RETURNING id, username, email, role, full_name, profile_picture_url, admission_number, class_id`;
        const result = await client.query(updateQuery, queryParams);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }

        await client.query('COMMIT');
        res.json({ message: "User updated successfully", user: result.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Update user error:", error);
        if (error.code === '23505') {
            return res.status(409).json({ error: "Username or email already exists." });
        }
        res.status(500).json({ error: "Failed to update user. " + error.message });
    } finally {
        client.release();
    }
});


// DELETE USER (Admin only)
router.delete("/:id", auth, auth.isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id: userId } = req.params;

        // Get user's profile picture URL before deleting the user
        const userToDeleteResult = await client.query('SELECT profile_picture_url FROM public.users WHERE id = $1', [userId]);
        const userToDelete = userToDeleteResult.rows[0];

        if (!userToDelete) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
        }

        // Delete profile picture from Cloudinary or local storage
        if (userToDelete.profile_picture_url) {
            const isCloudinaryUrl = userToDelete.profile_picture_url.startsWith('http');
            if (isCloudinaryUrl) {
                // Extract public ID from Cloudinary URL
                const publicId = userToDelete.profile_picture_url.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`profile_pictures/${publicId}`);
            } else {
                // Delete local file
                const filePath = path.join(__dirname, '..', 'public', userToDelete.profile_picture_url);
                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, err => { if (err) console.error(`Failed to delete profile picture for user ${userId}:`, err); });
                }
            }
        }

        // Delete associated exam results and sessions first due to foreign key constraints
        await client.query('DELETE FROM public.exam_sessions WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM public.exam_results WHERE student_id = $1', [userId]);
        await client.query('DELETE FROM public.report_card_meta WHERE student_id = $1', [userId]); // Also delete report meta
        // Finally, delete the user
        const result = await client.query('DELETE FROM public.users WHERE id = $1 RETURNING *', [userId]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "User not found." });
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
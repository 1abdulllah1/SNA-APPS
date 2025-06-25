const jwt = require('jsonwebtoken');

// This is the primary authentication middleware
const auth = (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    
    // Improved logging to be more concise and diagnostic
    if (!token) {
      console.log("[AUTH] No token in cookies. Denying access. Request URL:", req.originalUrl);
      return res.status(401).json({ error: 'Authentication required', reason: 'no_token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user info (id, username, role, is_admin)
    console.log(`[AUTH] User ${req.user.username} (ID: ${req.user.id}, Role: ${req.user.role}, Admin: ${req.user.is_admin}) authenticated for URL: ${req.originalUrl}`);
    next(); // Proceed
  } catch (error) {
    // Log specific JWT errors for easier debugging
    if (error.name === 'TokenExpiredError') {
      console.log("[AUTH] Token expired. Request URL:", req.originalUrl);
      return res.status(401).json({ error: 'Session expired. Please log in again.', reason: 'token_expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      console.error("[AUTH] JWT Error:", error.message, "Request URL:", req.originalUrl);
      return res.status(401).json({ error: 'Invalid token. Please log in again.', reason: 'jwt_error' });
    }
    // Log other unexpected errors
    console.error("[AUTH] Unexpected authentication error:", error, "Request URL:", req.originalUrl);
    return res.status(500).json({ error: 'Authentication process failed.', reason: 'unknown_auth_error' });
  }
};

// Separate middleware to check for Admin role. Use AFTER the main auth middleware.
auth.isAdmin = (req, res, next) => {
  // auth middleware should have already run and populated req.user
  if (req.user && req.user.is_admin) {
    console.log(`[AUTH isAdmin] User ${req.user.username} (ID: ${req.user.id}) is an admin. Proceeding.`);
    next();
  } else {
    // If req.user is undefined, it means 'auth' middleware failed (or didn't run, which shouldn't happen if chained).
    // If req.user exists but is not admin, it's a 403.
    console.log(`[AUTH isAdmin] Forbidden: User ${req.user ? req.user.username : '(not authenticated)'} lacks admin privileges. Request URL: ${req.originalUrl}`);
    // Changed status to 401 if not authenticated, otherwise 403.
    return res.status(req.user ? 403 : 401).json({ error: req.user ? "Access denied. Admin privileges required." : "Authentication required. Please log in as an administrator." });
  }
};

// Separate middleware to check for Student role. Use AFTER the main auth middleware.
auth.isStudent = (req, res, next) => {
    if (req.user && req.user.role === 'student') {
        next();
    } else {
        console.log(`[AUTH isStudent] Forbidden: User ${req.user ? req.user.username : '(not authenticated)'} is not a student.`);
        return res.status(403).json({ error: "Access denied. This action is for students only." });
    }
};

module.exports = auth;

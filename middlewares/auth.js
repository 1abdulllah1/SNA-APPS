const jwt = require('jsonwebtoken');

// This is the primary authentication middleware
const auth = (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    
    // Improved logging to be more concise
    if (!token) {
      console.log("[AUTH] No token in cookies. Denying access.");
      return res.status(401).json({ error: 'Authentication required', reason: 'no_token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user info (id, username, role, is_admin)
    next(); // Proceed
  } catch (error) {
    // Log specific JWT errors for easier debugging
    if (error.name === 'TokenExpiredError') {
      console.log("[AUTH] Token expired.");
      return res.status(401).json({ error: 'Session expired. Please log in again.', reason: 'token_expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      console.error("[AUTH] JWT Error:", error.message);
      return res.status(401).json({ error: 'Invalid token. Please log in again.', reason: 'jwt_error' });
    }
    // Log other unexpected errors
    console.error("[AUTH] Unexpected authentication error:", error);
    return res.status(500).json({ error: 'Authentication process failed.', reason: 'unknown_auth_error' });
  }
};

// Separate middleware to check for Admin role. Use AFTER the main auth middleware.
auth.isAdmin = (req, res, next) => {
  if (req.user && req.user.is_admin) {
    next();
  } else {
    console.log(`[AUTH isAdmin] Forbidden: User ${req.user ? req.user.username : '(not authenticated)'} lacks admin privileges.`);
    return res.status(403).json({ error: "Access denied. Admin privileges required." });
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

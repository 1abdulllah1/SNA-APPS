require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // fs is already required
const pool = require("./database/db"); // Assuming db.js is in a 'database' folder

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cookieParser());
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// CORS Configuration - ensure your frontend origin is allowed
app.use(cors({
  origin: ['http://localhost:5000', 'http://127.0.0.1:5000'], // Adjust if your frontend runs on a different port during dev
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging (optional, for debugging)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    // console.log('Request Body:', req.body); // Be cautious logging sensitive data
  }
  next();
});

// Serve static files from 'public' directory (HTML, CSS, JS, images)
// This includes the profile pictures in public/uploads/profile_pictures
app.use(express.static(path.join(__dirname, 'public')));


// API Routes
const examRoutes = require("./routes/exams");
const questionRoutes = require("./routes/questions"); // Assuming you have this
const examSessionRoutes = require("./routes/examSession"); // Assuming you have this
const userRoutes = require("./routes/users");

const subjectRoutes = require('./routes/subjects');
const resultRoutes = require("./routes/results");

app.use("/api/exams", examRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/exam-session", examSessionRoutes);
app.use("/api/users", userRoutes);
app.use('/api/subjects', subjectRoutes);
app.use("/api/exam-results", resultRoutes);


// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check DB error:", error);
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message
    });
  }
});

// SPA Fallback: Serve index.html for any route not handled above
// This is important for client-side routing in your SPA.
app.get('*', (req, res) => {
  // Check if the request is for an API route one last time (shouldn't be necessary if routes are defined before this)
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  
  // Otherwise, serve the main HTML file for the SPA
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback if index.html doesn't exist in public (should not happen in a correct setup)
    res.status(404).send('Main application HTML file not found. Please ensure `public/index.html` exists.');
  }
});

// Global error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error(`[GLOBAL ERROR HANDLER] ${err.stack}`);
  // Check if headers have already been sent
  if (res.headersSent) {
    return next(err); // Delegate to default Express error handler
  }
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal Server Error' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
  console.log(`🔗 Access the app at: http://localhost:${PORT}/login.html (or your main entry point)`);
});

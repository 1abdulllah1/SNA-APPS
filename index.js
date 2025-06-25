// index.js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pool = require("./database/db");
const initializeTables = require('./database/init'); // Ensure init.js is correctly located

// Initialize Database Tables (only if RUN_INIT is true in .env)
if (process.env.RUN_INIT === 'true') {
  initializeTables();
}

const app = express();

// Use the port Render provides OR fallback to 5000 for local development
const PORT = process.env.PORT || 3000;

// --- DYNAMIC CORS CONFIGURATION ---
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy does not allow access from the specified Origin: ${origin}.`), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Ensure all methods are allowed
  allowedHeaders: ['Content-Type', 'Authorization']     // Ensure headers are allowed
}));


// --- Standard Middleware ---
app.use(cookieParser());
app.use(express.json()); // Parses incoming JSON requests
app.use(express.urlencoded({ extended: true })); // Parses incoming URL-encoded requests

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---
// Ensure these paths correctly point to your route files and they export an Express Router
const userRoutes = require('./routes/users');
const examRoutes = require('./routes/exams');
const examSessionRoutes = require('./routes/examSession');
const resultRoutes = require('./routes/examResults');
const questionRoutes = require('./routes/questions');
const subjectRoutes = require('./routes/subjects');
const classRoutes = require('./routes/classes'); // Now correctly exports a router
const reportCardMetaRoutes = require('./routes/reportCardMeta'); // Now correctly exports a router


app.use("/api/users", userRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/exam-session", examSessionRoutes);
app.use("/api/exam-results", resultRoutes);

// Mount newly added routes
app.use("/api/questions", questionRoutes); // Assuming questions.js exists and exports a router
app.use("/api/subjects", subjectRoutes);
app.use("/api/classes", classRoutes); // This now correctly points to the new classes.js
app.use("/api/report-card-meta", reportCardMetaRoutes); // This now correctly points to the new reportCardMeta.js

// --- Health Check Endpoint ---
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1"); // Simple query to check DB connection
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


// --- Fallback for Client-Side Routing ---
// This should always be the last route handler
app.get('*', (req, res) => {
  // If the request is for an API endpoint that wasn't matched, return 404 JSON
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  // For all other requests, serve the main HTML file (assuming a Single Page Application)
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback if index.html is not found, useful during development without a frontend build
    res.status(404).send('Main HTML file not found. Please ensure your frontend is built or index.html exists in the public directory.');
  }
});


// --- Global Error Handler ---
// This middleware catches errors from preceding middleware and route handlers.
app.use((err, req, res, next) => {
  console.error(`[GLOBAL ERROR HANDLER] ${err.stack}`);
  if (res.headersSent) { // Check if headers have already been sent to prevent double-sending
    return next(err); // Pass to default Express error handler if headers sent
  }
  res.status(err.statusCode || 500).json({
    error: err.message || 'An unexpected server error occurred.',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined // Provide stack in development mode
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pool = require("./database/db");
const initializeTables = require('./database/init');
 // Adjust if your DB file is elsewhere

const app = express();

// Use the port Render provides OR fallback to 3000 for local development
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - allow frontend to connect
app.use(cors({
  origin: ['http://localhost:5000', 'http://127.0.0.1:5000'], // Add deployed frontend URL when available
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const examRoutes = require("./routes/exams");
const questionRoutes = require("./routes/questions");
const examSessionRoutes = require("./routes/examSession");
const userRoutes = require("./routes/users");
const subjectRoutes = require('./routes/subjects');
const resultRoutes = require("./routes/results");

app.use("/api/exams", examRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/exam-session", examSessionRoutes);
app.use("/api/users", userRoutes);
app.use('/api/subjects', subjectRoutes);
app.use("/api/exam-results", resultRoutes);

// Health check
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

// Fallback for client-side routing (SPA)
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }

  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Main HTML file not found.');
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[GLOBAL ERROR HANDLER] ${err.stack}`);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

initializeTables();


// Start the server — use '0.0.0.0' for Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
  console.log(`🔗 Access the app at: http://localhost:${PORT}/login.html`);
});

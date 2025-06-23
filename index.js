require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pool = require("./database/db");

const app = express();
const PORT = process.env.PORT || 3000;

// --- DYNAMIC CORS CONFIGURATION ---
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy does not allow access from the specified Origin.'), false);
    }
  },
  credentials: true
}));


// --- Standard Middleware ---
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---
// **FIX**: These lines were commented out, causing the 404 error. They are now active.
// Make sure you have a 'routes' folder with these files in it.
const userRoutes = require('./routes/users');
const examRoutes = require('./routes/exams');
const examSessionRoutes = require('./routes/examSession');
const resultRoutes = require('./routes/results');

app.use("/api/users", userRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/exam-session", examSessionRoutes);
app.use("/api/exam-results", resultRoutes);


// --- Health Check Endpoint ---
app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// --- Fallback for Client-Side Routing ---
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  // All non-API requests will serve the main HTML file, letting the client-side handle routing.
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error(`[GLOBAL ERROR HANDLER] ${err.stack}`);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
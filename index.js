// index.js
// This is the main entry point for your Express.js backend application.
// It sets up the server, defines middleware, mounts API routes, and handles static file serving.

// Load environment variables from .env file in non-production environments.
// This allows you to configure sensitive information (like database credentials, JWT secrets)
// without hardcoding them directly into your code.
require('dotenv').config();

// Import necessary modules
const express = require('express');        // Fast, unopinionated, minimalist web framework for Node.js
const cookieParser = require('cookie-parser'); // Parse Cookie header and populate req.cookies
const cors = require('cors');              // Provide a Connect/Express middleware that can be used to enable CORS
const path = require('path');              // Utilities for working with file and directory paths
const fs = require('fs');                  // File system module for path checks
const pool = require("./database/db");     // Your PostgreSQL database connection pool
const initializeTables = require('./database/init'); // Script to initialize database tables

// Initialize Database Tables (conditionally)
// This block ensures that your database tables are created (or updated)
// only when the RUN_INIT environment variable is set to 'true'.
// This is useful for initial setup or migrations, but should be managed carefully in production.
if (process.env.RUN_INIT === 'true') {
  console.log("Initializing database tables as RUN_INIT is true...");
  initializeTables();
}

// Create an Express application instance
const app = express();

// Define the port for the server to listen on.
// It uses the PORT environment variable provided by deployment platforms (e.g., Render)
// or defaults to 3000 for local development.
const PORT = process.env.PORT || 3000;

// --- DYNAMIC CORS CONFIGURATION ---
// CORS (Cross-Origin Resource Sharing) is a security feature implemented by web browsers
// that prevents a web page from making requests to a different domain than the one that served the web page.
// This configuration allows specific origins (your frontend URLs) to make requests to this backend.
const allowedOrigins = [
  'http://localhost:3000',   // Common local development port for frontend
  'http://127.0.0.1:3000',   // Alternative local IP
  'http://localhost:5000',   // Another common local frontend development port
  'http://127.0.0.1:5000'    // Alternative local IP
];

// If a FRONTEND_URL environment variable is set (typical in deployment), add it to allowed origins.
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
  console.log(`Added production FRONTEND_URL to CORS: ${process.env.FRONTEND_URL}`);
}

// Configure the CORS middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl requests, same-origin requests).
    // This is important for non-browser clients or for initial requests from the same origin.
    if (!origin) return callback(null, true);

    // Check if the requesting origin is in our list of allowed origins.
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true); // Allow the request
    } else {
      // Deny the request if the origin is not allowed.
      console.warn(`CORS Error: Origin '${origin}' not allowed by CORS policy.`);
      callback(new Error(`CORS policy does not allow access from the specified Origin: ${origin}.`), false);
    }
  },
  credentials: true, // Crucial: Allows cookies (like your JWT) to be sent and received across origins.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow common HTTP methods.
  allowedHeaders: ['Content-Type', 'Authorization'],     // Explicitly allow common headers.
}));


// --- Standard Middleware ---

// Middleware to parse cookies attached to the client request.
// Populates req.cookies with an object keyed by cookie names.
app.use(cookieParser());

// Middleware to parse incoming request bodies as JSON.
// This is essential for handling POST/PUT requests with JSON payloads (e.g., login, registration).
// It populates req.body with the parsed JSON data.
app.use(express.json());

// Middleware to parse incoming request bodies as URL-encoded data.
// Useful for traditional HTML form submissions. `extended: true` allows for rich objects and arrays.
app.use(express.urlencoded({ extended: true }));

// Custom Request Logger Middleware
// Logs details of each incoming HTTP request to the console. Useful for debugging.
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next(); // Pass control to the next middleware or route handler
});

// Serve static files from the 'public' directory
// This middleware serves static assets (HTML, CSS, JavaScript, images, etc.)
// from the 'public' folder. For example, 'public/styles.css' would be accessible at '/styles.css'.
app.use(express.static(path.join(__dirname, 'public')));


// --- API Routes ---
// Import and mount your API routers. Each router handles a specific set of related endpoints.
// Ensure these paths correctly point to your route files and that each file exports an Express Router.
const userRoutes = require('./routes/users');
const examRoutes = require('./routes/exams');
const examSessionRoutes = require('./routes/examSession');
const resultRoutes = require('./routes/examResults');
const questionRoutes = require('./routes/questions');
const subjectRoutes = require('./routes/subjects');
const classLevelsRoutes = require('./routes/class-levels');
const classRoutes = require('./routes/classes');
const reportCardMetaRoutes = require('./routes/reportCardMeta');
const adminRoutes = require('./routes/admin');

// Mount the routers to their respective base paths.
// All routes defined in `users.js` will be prefixed with `/api/users`.
app.use("/api/users", userRoutes);
app.use("/api/exams", examRoutes);
// FIX: Changed route path from singular '/api/exam-session' to plural '/api/exam-sessions'
// to match the frontend calls in exam.html
app.use("/api/exam-sessions", examSessionRoutes);
app.use("/api/exam-results", resultRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/class-levels", classLevelsRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/report-card-meta", reportCardMetaRoutes);
app.use('/api/admin', adminRoutes);


// --- Health Check Endpoint ---
// A simple endpoint to check the health and connectivity of the server and database.
// Useful for monitoring in deployment environments.
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1"); // A minimal query to test database connection
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
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


// --- Fallback for Client-Side Routing (Catch-all Route) ---
// This route should always be defined *last*, after all API and static file routes.
// It ensures that any request not matched by previous routes is handled by serving the main HTML file.
// This is common in Single Page Applications (SPAs) where the client-side router takes over.
app.get('*', (req, res) => {
  // If the request path starts with '/api/', it's an API call that wasn't matched.
  // In this case, respond with a 404 JSON error for API consumers.
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }

  // For all other requests (non-API), serve the main HTML file, typically `index.html`.
  // This allows frontend frameworks to handle routing on the client side.
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // If 'index.html' is not found in the 'public' directory, something is wrong
    // with the build or deployment. Provide a clear error message.
    console.error("index.html not found in public directory. Ensure frontend is built or path is correct.");
    res.status(404).send('Main HTML file not found. Please ensure your frontend is built or index.html exists in the public directory.');
  }
});


// --- Global Error Handling Middleware ---
// This is an Express error-handling middleware (takes 4 arguments: err, req, res, next).
// It catches errors thrown by preceding middleware or route handlers.
app.use((err, req, res, next) => {
  // Log the full error stack for debugging purposes.
  console.error(`[GLOBAL ERROR HANDLER] ${err.stack}`);

  // If headers have already been sent to the client, it means a response has already
  // started, so we delegate to Express's default error handler to prevent issues.
  if (res.headersSent) {
    return next(err);
  }

  // Send a JSON error response to the client.
  // Use the error's statusCode if available, otherwise default to 500 (Internal Server Error).
  res.status(err.statusCode || 500).json({
    error: err.message || 'An unexpected server error occurred.',
    // In development, provide the full error stack for easier debugging.
    // In production, avoid sending sensitive stack traces to clients.
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start the server and listen for incoming requests on the specified PORT.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access application at: http://localhost:${PORT}`);
  if (process.env.FRONTEND_URL) {
      console.log(`Deployed frontend URL: ${process.env.FRONTEND_URL}`);
  }
});

const pool = require('./db');
const bcrypt = require('bcryptjs');


async function initializeTables() {
  try {
    // USERS table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'student',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // QUESTIONS table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question_text TEXT NOT NULL,
        options TEXT[],  -- Or change if you store options differently
        correct_option VARCHAR(10) NOT NULL,
        subject VARCHAR(100),
        level VARCHAR(50)
      );
    `);

    // RESULTS table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        score INTEGER,
        total INTEGER,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ All tables initialized successfully.");
  await createDefaultUser(); // ← add this
  } catch (error) {
    console.error("❌ Error initializing tables:", error);
  }
}

async function createDefaultUser() {
  try {
    const email = 'sealednec@gmail.com'; // Change if you want
    const username = 'Abu';
    const role = 'admin';
    const password = 'abusumayah'; // Change this too (IMPORTANT)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user already exists
    const userExists = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

    if (userExists.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)`,
        [username, email, hashedPassword, 'admin']
      );
      console.log('✅ Default admin user created.');
    } else {
      console.log('ℹ️ Default user already exists.');
    }
  } catch (error) {
    console.error('❌ Error creating default user:', error);
  }
}

module.exports = initializeTables;

// database/init.js
const pool = require('./db');

// Function to initialize database tables
const initializeTables = async () => {
    try {
        console.log("Initializing database tables...");

        // Create 'users' table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'student',
                is_admin BOOLEAN DEFAULT FALSE,
                profile_picture_url VARCHAR(255),
                admission_number VARCHAR(100) UNIQUE,
                class_id INT REFERENCES classes(class_id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("'users' table checked/created.");

        // Create 'classes' table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS classes (
                class_id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                class_code VARCHAR(50) UNIQUE NOT NULL,
                level INT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("'classes' table checked/created.");

        // Create 'subjects' table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                subject_id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                subject_code VARCHAR(50) UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("'subjects' table checked/created.");


        // Create 'exams' table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS exams (
                exam_id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                subject_id INT NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
                class_id INT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                duration_minutes INT NOT NULL,
                total_marks INT NOT NULL,
                pass_mark INT NOT NULL,
                start_time TIMESTAMP WITH TIME ZONE NOT NULL,
                end_time TIMESTAMP WITH TIME ZONE NOT NULL,
                exam_type VARCHAR(50) NOT NULL DEFAULT 'MAIN_EXAM', -- e.g., 'MAIN_EXAM', 'CA1', 'MID_TERM'
                term VARCHAR(50) NOT NULL, -- e.g., 'FIRST', 'SECOND', 'THIRD'
                session VARCHAR(50) NOT NULL, -- e.g., '2023/2024'
                created_by INT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("'exams' table checked/created.");

        // NEW: Create 'exam_sections' table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS exam_sections (
                section_id SERIAL PRIMARY KEY,
                exam_id INT NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
                section_title VARCHAR(255) NOT NULL, -- Renamed from section_name to section_title
                section_instructions TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("'exam_sections' table checked/created.");


        // Create 'questions' table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS questions (
                question_id SERIAL PRIMARY KEY,
                -- Changed exam_id to be nullable here if sections are the primary link
                -- but better to keep it NOT NULL and ensure it's always provided
                exam_id INT NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE, 
                section_id INT NOT NULL REFERENCES exam_sections(section_id) ON DELETE CASCADE,
                question_text TEXT NOT NULL,
                question_type VARCHAR(50) NOT NULL DEFAULT 'multiple_choice', -- e.g., 'multiple_choice', 'true_false', 'short_answer'
                options JSONB, -- For multiple choice: {a: "...", b: "...", c: "..."}
                correct_answer TEXT NOT NULL,
                marks INT NOT NULL DEFAULT 1,
                image_url VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("'questions' table checked/created.");

        // Create 'exam_results' table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS exam_results (
                result_id SERIAL PRIMARY KEY,
                exam_id INT NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
                student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                score DECIMAL(5, 2) NOT NULL, -- Percentage score or raw score
                raw_score_obtained INT, -- Store raw score out of total possible marks
                total_possible_marks INT, -- Store total marks for the exam (sum of question marks)
                answers_submitted JSONB NOT NULL, -- Store student's submitted answers
                submission_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Ensure this column exists
                UNIQUE(exam_id, student_id) -- Ensure a student can only submit one result per exam
            );
        `);
        console.log("'exam_results' table checked/created.");

        // Create 'exam_sessions' table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS exam_sessions (
                session_id SERIAL PRIMARY KEY,
                student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                exam_id INT NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
                start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP WITH TIME ZONE,
                is_completed BOOLEAN DEFAULT FALSE,
                last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, exam_id) -- Ensure only one active session per student per exam
            );
        `);
        console.log("'exam_sessions' table checked/created.");

        // Create 'report_card_meta' table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS report_card_meta (
                meta_id SERIAL PRIMARY KEY,
                student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                term VARCHAR(50) NOT NULL,
                session VARCHAR(50) NOT NULL,
                class_level VARCHAR(100), -- Store the class level/name as text for the report
                teacher_comment TEXT,
                principal_comment TEXT,
                next_term_begins DATE,
                cumulative_data JSONB, -- Stores array of objects like [{subjectName: "Math", finalScore: 75.0}]
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, term, session)
            );
        `);
        console.log("'report_card_meta' table checked/created.");


        console.log("Database initialization complete.");

    } catch (error) {
        console.error("Error initializing database:", error);
    } finally {
        // It's generally not recommended to close the pool immediately in a server app,
        // as it prevents further queries. The pool should remain open for the app's lifetime.
        // If you were running this as a one-off script, you might close it here.
        // pool.end();
    }
};

module.exports = initializeTables;

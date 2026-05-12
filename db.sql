-- Database Creation
CREATE DATABASE IF NOT EXISTS personnel_db;
USE personnel_db;

-- Users Table (for Authentication)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Personnel Table
CREATE TABLE IF NOT EXISTS personnel (
    id VARCHAR(50) NOT NULL, -- Personnel ID (کد پرسنلی)
    db_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    dependents_count INT DEFAULT 0,
    gender VARCHAR(20),
    national_id VARCHAR(10) NOT NULL,
    birth_date VARCHAR(20),
    age INT,
    father_name VARCHAR(100),
    id_number VARCHAR(50),
    status VARCHAR(50),
    relation_code VARCHAR(20),
    phone_number VARCHAR(20),
    relation VARCHAR(50),
    disease_type VARCHAR(100),
    experience_years INT DEFAULT 0,
    work_group VARCHAR(100),
    unit VARCHAR(100),
    position VARCHAR(100),
    mining_exp_days INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert Default Admin (Password: admin123 - hashed version would be better, but we'll handle in code or setup)
-- Note: In a production setup, you should hash the password.
-- This is just for reference.

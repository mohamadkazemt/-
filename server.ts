import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// SQLite Database Setup
const db = new Database('personnel.db');

// Initialize Database Schema
const schema = fs.readFileSync(path.join(process.cwd(), 'db.sql'), 'utf8');
// Simple cleanup for SQLite compatibility
// SQLite doesn't support CREATE DATABASE or USE
const sqliteSchema = schema
  .split('\n')
  .filter(line => !line.trim().startsWith('CREATE DATABASE') && !line.trim().startsWith('USE '))
  .join('\n')
  .replace(/INT AUTOINCREMENT PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
  .replace(/AUTOINCREMENT PRIMARY KEY/g, 'PRIMARY KEY AUTOINCREMENT')
  .replace(/AUTO_INCREMENT/g, 'AUTOINCREMENT')
  .replace(/INT /g, 'INTEGER ')
  .replace(/VARCHAR\(\d+\)/g, 'TEXT')
  .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/g, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
  .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, 'DATETIME DEFAULT CURRENT_TIMESTAMP');

try {
  // Execute multiple statements: better-sqlite3 exec() is fine for this
  db.exec(sqliteSchema);
  console.log('Database schema initialized.');
} catch (err) {
  console.error('Error initializing database schema:', err);
}

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

// API: Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt for email: ${email}`);

  // Simple admin check based on env for initial setup
  if (email === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
    console.log('Admin login match from env');
    try {
      const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, email });
    } catch (tokenErr) {
      console.error('JWT Signing error:', tokenErr);
      return res.status(500).json({ error: 'Token generation failed' });
    }
  }

  // Database check
  try {
    console.log('Checking database for user...');
    const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) {
      console.log('User found in database, verifying password...');
      const validPassword = await bcrypt.compare(password, user.password);
      if (validPassword) {
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token, email: user.email });
      }
      console.log('Invalid password for user');
    } else {
      console.log('User not found in database');
    }
    res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
  } catch (error) {
    console.error('Login database/bcrypt error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API: Get All Personnel
app.get("/api/personnel", authenticateToken, async (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM personnel ORDER BY last_name ASC').all();
    res.json(rows);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API: Add/Batch Add Personnel
app.post("/api/personnel", authenticateToken, async (req, res) => {
  const personnelInput = Array.isArray(req.body) ? req.body : [req.body];
  
  try {
    const insert = db.prepare(`INSERT INTO personnel (
      id, first_name, last_name, dependents_count, gender, national_id, birth_date, age, 
      father_name, id_number, status, relation_code, phone_number, relation, disease_type, 
      experience_years, work_group, unit, position, mining_exp_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const transaction = db.transaction((items) => {
      for (const p of items) {
        insert.run(
          p.id, p.firstName, p.lastName, p.dependentsCount, p.gender, p.nationalId, p.birthDate, p.age,
          p.fatherName, p.idNumber, p.status, p.relationCode, p.phoneNumber, p.relation, p.diseaseType,
          p.experienceYears, p.workGroup, p.unit, p.position, p.miningExpDays
        );
      }
    });

    transaction(personnelInput);
    res.json({ message: 'Personnel added successfully' });
  } catch (error) {
    console.error('Add error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API: Update Personnel
app.put("/api/personnel/:db_id", authenticateToken, async (req, res) => {
  const { db_id } = req.params;
  const p = req.body;

  try {
    const sql = `UPDATE personnel SET 
      id=?, first_name=?, last_name=?, dependents_count=?, gender=?, national_id=?, birth_date=?, age=?, 
      father_name=?, id_number=?, status=?, relation_code=?, phone_number=?, relation=?, disease_type=?, 
      experience_years=?, work_group=?, unit=?, position=?, mining_exp_days=?
      WHERE db_id=?`;

    db.prepare(sql).run(
      p.id, p.firstName, p.lastName, p.dependentsCount, p.gender, p.nationalId, p.birthDate, p.age,
      p.fatherName, p.idNumber, p.status, p.relationCode, p.phoneNumber, p.relation, p.diseaseType,
      p.experienceYears, p.workGroup, p.unit, p.position, p.miningExpDays,
      db_id
    );
    res.json({ message: 'Personnel updated successfully' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API: Delete Personnel
app.delete("/api/personnel/:db_id", authenticateToken, async (req, res) => {
  const { db_id } = req.params;
  try {
    db.prepare('DELETE FROM personnel WHERE db_id = ?').run(db_id);
    res.json({ message: 'Personnel deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

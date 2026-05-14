import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";

dotenv.config({ override: true });

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// SQLite Database Setup
const db = new Database('personnel.db');

// Initialize Database Schema
const schema = fs.readFileSync(path.join(process.cwd(), 'db.sql'), 'utf8');
// Simple cleanup for SQLite compatibility
// SQLite doesn't support CREATE DATABASE or USE
const sqliteSchema = schema
  .split('\n')
  .filter(line => {
    const trimmed = line.trim().toUpperCase();
    return !trimmed.startsWith('CREATE DATABASE') && !trimmed.startsWith('USE ') && !trimmed.startsWith('--');
  })
  .join('\n')
  .replace(/INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
  .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
  .replace(/\bINT\b/gi, 'INTEGER')
  .replace(/VARCHAR\(\d+\)/gi, 'TEXT')
  .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
  .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP');

try {
  // Execute multiple statements: better-sqlite3 exec() is fine for this
  db.exec(sqliteSchema);
  console.log('Database schema initialized.');

  // Migration: Add hire_date if it doesn't exist
  try {
    db.prepare("ALTER TABLE personnel ADD COLUMN hire_date TEXT").run();
    console.log('Migration: Added hire_date column to personnel table.');
  } catch (e: any) {}

  // Migration: Add job_title_kerman if it doesn't exist
  try {
    db.prepare("ALTER TABLE personnel ADD COLUMN job_title_kerman TEXT").run();
    console.log('Migration: Added job_title_kerman column.');
  } catch (e: any) {}

  // Migration: Add workshop_position if it doesn't exist
  try {
    db.prepare("ALTER TABLE personnel ADD COLUMN workshop_position TEXT").run();
    console.log('Migration: Added workshop_position column.');
  } catch (e: any) {}

  // Migration: Add unique index on national_id to support UPSERT/REPLACE
  try {
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_national_id ON personnel(national_id)").run();
    console.log('Migration: Added unique index on national_id.');
  } catch (e: any) {
    console.error('Migration index error:', e.message);
  }

  // Seed default admin if no users exist
  const count: any = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (count.count === 0) {
    const adminEmail = process.env.ADMIN_USER || 'admin@example.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPass = bcrypt.hashSync(adminPass, 10);
    db.prepare('INSERT INTO users (email, password, role) VALUES (?, ?, ?)').run(adminEmail, hashedPass, 'admin');
    console.log(`Default admin user created successfully: ${adminEmail}`);
  }
} catch (err) {
  console.error('Error initializing database schema or seeding:', err);
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
  } catch (error: any) {
    console.error('Login database/bcrypt error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API: Get All Personnel
app.get("/api/personnel", authenticateToken, async (req: any, res) => {
  try {
    console.log(`Fetching personnel for user: ${req.user?.email}`);
    const rows = db.prepare('SELECT * FROM personnel ORDER BY last_name ASC').all();
    console.log(`Found ${rows.length} records.`);
    res.json(rows);
  } catch (error: any) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// API: Add/Batch Add Personnel
app.post("/api/personnel", authenticateToken, async (req, res) => {
  const personnelInput = Array.isArray(req.body) ? req.body : [req.body];
  
  if (personnelInput.length === 0) {
    return res.json({ message: 'No personnel data provided' });
  }

  try {
    const insert = db.prepare(`INSERT INTO personnel (
      id, first_name, last_name, dependents_count, gender, national_id, birth_date, age, 
      father_name, id_number, status, relation_code, phone_number, relation, disease_type, 
      experience_years, work_group, unit, position, job_title_kerman, workshop_position, mining_exp_days, hire_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(national_id) DO UPDATE SET
      id=excluded.id,
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      dependents_count=excluded.dependents_count,
      gender=excluded.gender,
      birth_date=excluded.birth_date,
      age=excluded.age,
      father_name=excluded.father_name,
      id_number=excluded.id_number,
      status=excluded.status,
      relation_code=excluded.relation_code,
      phone_number=excluded.phone_number,
      relation=excluded.relation,
      disease_type=excluded.disease_type,
      experience_years=excluded.experience_years,
      work_group=excluded.work_group,
      unit=excluded.unit,
      position=excluded.position,
      job_title_kerman=excluded.job_title_kerman,
      workshop_position=excluded.workshop_position,
      mining_exp_days=excluded.mining_exp_days,
      hire_date=excluded.hire_date,
      updated_at=CURRENT_TIMESTAMP`);

    const transaction = db.transaction((items) => {
      let added = 0;
      for (const p of items) {
        // Validation for NOT NULL fields - skip if missing critical info
        if (!p.firstName && !p.lastName && !p.nationalId) {
          console.warn('Skipping empty row');
          continue; 
        }
        
        if (!p.nationalId) {
           // If it's a valid looking row but missing nationalId, we can either skip or use a placeholder
           // For now, let's skip row with warning if it's missing important info
           console.warn(`Skipping row for ${p.firstName || ''} ${p.lastName || ''} due to missing National ID`);
           continue;
        }

        insert.run(
          p.id || '', 
          p.firstName || '', 
          p.lastName || '', 
          p.dependentsCount || 0, 
          p.gender || 'نامشخص', 
          p.nationalId, 
          p.birthDate || '', 
          p.age || 0,
          p.fatherName || '', 
          p.idNumber || '', 
          p.status || '', 
          p.relationCode || '', 
          p.phoneNumber || '', 
          p.relation || '', 
          p.diseaseType || 'سالم',
          p.experienceYears || 0, 
          p.workGroup || '', 
          p.unit || '', 
          p.position || '', 
          p.jobTitleKerman || '',
          p.workshopPosition || '',
          p.miningExpDays || 0,
          p.hireDate || ''
        );
        added++;
      }
      return added;
    });

    const count = transaction(personnelInput);
    res.json({ message: 'Personnel processed successfully', count });
  } catch (error: any) {
    console.error('Add error:', error);
    res.status(500).json({ 
      error: 'Failed to add personnel', 
      message: error.message 
    });
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
      experience_years=?, work_group=?, unit=?, position=?, job_title_kerman=?, workshop_position=?, mining_exp_days=?, hire_date=?
      WHERE db_id=?`;

    db.prepare(sql).run(
      p.id, p.firstName, p.lastName, p.dependentsCount, p.gender, p.nationalId, p.birthDate, p.age,
      p.fatherName, p.idNumber, p.status, p.relationCode, p.phoneNumber, p.relation, p.diseaseType,
      p.experienceYears, p.workGroup, p.unit, p.position, p.jobTitleKerman, p.workshopPosition, p.miningExpDays, p.hireDate,
      db_id
    );
    res.json({ message: 'Personnel updated successfully' });
  } catch (error: any) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// API: Delete Personnel
app.delete("/api/personnel/:db_id", authenticateToken, async (req, res) => {
  const { db_id } = req.params;
  try {
    db.prepare('DELETE FROM personnel WHERE db_id = ?').run(db_id);
    res.json({ message: 'Personnel deleted successfully' });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
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

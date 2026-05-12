import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'personnel_db',
  port: Number(process.env.MYSQL_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

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

  // Simple admin check based on env for initial setup
  if (email === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, email });
  }

  // Database check
  try {
    const [rows]: any = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
      const user = rows[0];
      const validPassword = await bcrypt.compare(password, user.password);
      if (validPassword) {
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token, email: user.email });
      }
    }
    res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API: Get All Personnel
app.get("/api/personnel", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM personnel ORDER BY last_name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API: Add/Batch Add Personnel
app.post("/api/personnel", authenticateToken, async (req, res) => {
  const personnel = Array.isArray(req.body) ? req.body : [req.body];
  
  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    const sql = `INSERT INTO personnel (
      id, first_name, last_name, dependents_count, gender, national_id, birth_date, age, 
      father_name, id_number, status, relation_code, phone_number, relation, disease_type, 
      experience_years, work_group, unit, position, mining_exp_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (const p of personnel) {
      await connection.execute(sql, [
        p.id, p.firstName, p.lastName, p.dependentsCount, p.gender, p.nationalId, p.birthDate, p.age,
        p.fatherName, p.idNumber, p.status, p.relationCode, p.phoneNumber, p.relation, p.diseaseType,
        p.experienceYears, p.workGroup, p.unit, p.position, p.miningExpDays
      ]);
    }

    await connection.commit();
    connection.release();
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

    await pool.execute(sql, [
      p.id, p.firstName, p.lastName, p.dependentsCount, p.gender, p.nationalId, p.birthDate, p.age,
      p.fatherName, p.idNumber, p.status, p.relationCode, p.phoneNumber, p.relation, p.diseaseType,
      p.experienceYears, p.workGroup, p.unit, p.position, p.miningExpDays,
      db_id
    ]);
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
    await pool.execute('DELETE FROM personnel WHERE db_id = ?', [db_id]);
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

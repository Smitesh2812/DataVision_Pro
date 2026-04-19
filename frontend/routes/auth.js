// routes/auth.js
// All authentication endpoints.
//
// POST /api/auth/register  — create new account
// POST /api/auth/login     — sign in, get JWT
// POST /api/auth/logout    — invalidate session
// GET  /api/auth/me        — get current user profile
// PUT  /api/auth/profile   — update profile

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// ─── HELPERS ─────────────────────────────────────────────────
// Generates a random hex color for the user's avatar
const AVATAR_COLORS = ['#5b8ff9','#34d399','#f97316','#7c6bf5','#fb7185','#2dd4bf','#fbbf24','#a78bfa'];
const randomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

// Create a JWT + store session in DB
async function createSession(userId, req) {
  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, tokenHash, req.ip, req.headers['user-agent'], expiresAt]
  );

  return token;
}

// Log important actions to audit_log table
async function auditLog(userId, action, detail, ip) {
  await pool.query(
    'INSERT INTO audit_log (user_id, action, detail, ip_address) VALUES (?, ?, ?, ?)',
    [userId, action, detail, ip]
  ).catch(() => {}); // Don't fail the request if audit log fails
}

// ─── REGISTER ────────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').trim().notEmpty().withMessage('First name required'),
], async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, firstName, lastName, company } = req.body;

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password — bcrypt with 12 rounds (very secure, ~300ms)
    // NEVER store plain text passwords. Ever.
    const passwordHash = await bcrypt.hash(password, 12);

    // MySQL has no RETURNING clause — INSERT then SELECT
    await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, company, avatar_color)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, passwordHash, firstName, lastName || '', company || '', randomColor()]
    );
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, company, role, plan, avatar_color
       FROM users WHERE email = ?`,
      [email]
    );

    const user = result.rows[0];
    const token = await createSession(user.id, req);
    await auditLog(user.id, 'register', `New account: ${email}`, req.ip);

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        company: user.company,
        role: user.role,
        plan: user.plan,
        avatarColor: user.avatar_color,
      }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// ─── LOGIN ───────────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid email or password format.' });
  }

  const { email, password } = req.body;

  try {
    // Find user by email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal whether email exists — generic error
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Compare password with stored hash
    // bcrypt.compare does the comparison securely (timing-safe)
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      await auditLog(user.id, 'login_failed', `Failed login attempt for ${email}`, req.ip);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Create session and token
    const token = await createSession(user.id, req);

    // Update last_login timestamp
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    await auditLog(user.id, 'login', `Login from ${req.ip}`, req.ip);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        company: user.company,
        role: user.role,
        plan: user.plan,
        avatarColor: user.avatar_color,
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ─── LOGOUT ──────────────────────────────────────────────────
// POST /api/auth/logout  (requires auth)
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // Invalidate the current session token in DB
    await pool.query(
      'UPDATE sessions SET is_valid = FALSE WHERE token_hash = ?',
      [req.tokenHash]
    );
    await auditLog(req.user.id, 'logout', null, req.ip);
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Logout error.' });
  }
});

// ─── GET CURRENT USER ────────────────────────────────────────
// GET /api/auth/me  (requires auth)
router.get('/me', authMiddleware, async (req, res) => {
  const u = req.user;
  res.json({
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    company: u.company,
    role: u.role,
    plan: u.plan,
    avatarColor: u.avatar_color,
  });
});

// ─── UPDATE PROFILE ──────────────────────────────────────────
// PUT /api/auth/profile  (requires auth)
router.put('/profile', authMiddleware, [
  body('firstName').optional().trim().notEmpty(),
  body('company').optional().trim(),
], async (req, res) => {
  const { firstName, lastName, company } = req.body;
  try {
    await pool.query(
      `UPDATE users SET
         first_name = COALESCE(?, first_name),
         last_name  = COALESCE(?, last_name),
         company    = COALESCE(?, company),
         updated_at = NOW()
       WHERE id = ?`,
      [firstName, lastName, company, req.user.id]
    );
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, company, role, plan, avatar_color
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    res.json({ message: 'Profile updated', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Update error.' });
  }
});

export default router;
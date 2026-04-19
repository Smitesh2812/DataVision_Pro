// middleware/auth.js
// This middleware runs BEFORE any protected route handler.
// It checks the JWT token and attaches the user to req.user.
//
// Usage in routes:
//   router.get('/protected', authMiddleware, (req, res) => { ... })
//   router.get('/admin-only', authMiddleware, requireRole('admin'), (req, res) => { ... })

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db/pool.js';

// ─── MAIN AUTH MIDDLEWARE ────────────────────────────────────
const authMiddleware = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    //    Client sends: "Authorization: Bearer eyJhbGciOiJ..."
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify JWT signature and expiry
    //    jwt.verify throws if token is expired or tampered with
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // 3. Check if session is still valid in DB (handles logout)
    //    We store a hash of the token, not the token itself
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessionResult = await pool.query(
      'SELECT id FROM sessions WHERE token_hash = ? AND is_valid = TRUE AND expires_at > NOW()',
      [tokenHash]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session invalidated. Please log in again.' });
    }

    // 4. Get fresh user data from DB
    const userResult = await pool.query(
      'SELECT id, email, first_name, last_name, company, role, plan, avatar_color, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated.' });
    }

    // 5. Attach user to request so route handlers can use it
    req.user = userResult.rows[0];
    req.tokenHash = tokenHash;
    next();

  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication error.' });
  }
};

// ─── ROLE GUARD MIDDLEWARE ───────────────────────────────────
// Usage: requireRole('admin') or requireRole(['admin', 'owner'])
const requireRole = (roles) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ error: `Access denied. Required role: ${allowed.join(' or ')}` });
  }
  next();
};

// ─── PLAN GUARD MIDDLEWARE ───────────────────────────────────
// Usage: requirePlan('pro') — blocks free users from pro features
const requirePlan = (plans) => (req, res, next) => {
  const allowed = Array.isArray(plans) ? plans : [plans];
  if (!allowed.includes(req.user.plan)) {
    return res.status(403).json({
      error: 'Upgrade required',
      message: `This feature requires a ${allowed[0]} plan.`,
      upgrade_url: '/pricing'
    });
  }
  next();
};

export { authMiddleware, requireRole, requirePlan };

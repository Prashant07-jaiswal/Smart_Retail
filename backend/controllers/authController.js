const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const { signToken } = require('../config/jwt');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { isValidEmail } = require('../middleware/validate');

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/register
 * Customers self-register. Owner accounts are seeded, not self-registered,
 * to keep the demo's role boundary simple and safe.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!isValidEmail(email)) {
    throw new ApiError(400, 'Please provide a valid email address.');
  }
  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters long.');
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'customer')
     RETURNING id, name, email, role, created_at`,
    [name, email.toLowerCase(), passwordHash]
  );

  const user = result.rows[0];
  const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });

  res.status(201).json({ user, token });
});

/**
 * POST /api/auth/login
 * Shared login endpoint for both customer and owner roles.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  if (result.rows.length === 0) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    token,
  });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user (based on JWT).
 */
const me = asyncHandler(async (req, res) => {
  const result = await query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
  if (result.rows.length === 0) {
    throw new ApiError(404, 'User not found.');
  }
  res.json({ user: result.rows[0] });
});

module.exports = { register, login, me };

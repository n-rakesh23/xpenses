const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const {
  upsertUser,
  getUserByPhone,
  createSession,
  deleteSession,
  getSessionByTokenHash,
} = require('../db/queries');
const { randomToken, sha256 } = require('../utils/crypto');
const logger = require('../utils/logger');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

/**
 * POST /api/auth/magic-link
 * Generates a magic link token and (in production) sends via email/SMS.
 * In dev/demo mode, returns the token directly.
 */
router.post(
  '/magic-link',
  [
    body('platform').optional().isIn(['whatsapp', 'telegram']),
    body('platform_user_id').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { phone, platform, platform_user_id } = req.body;

      let user;
      if (platform && platform_user_id) {
        user = await upsertUser(platform, platform_user_id, { phone });
      } else if (phone) {
        user = await getUserByPhone(phone);
        if (!user) {
          // Create a user with a placeholder platform
          user = await upsertUser('telegram', `phone:${phone}`, { phone });
        }
      } else {
        return res.status(422).json({ error: 'Provide phone or platform credentials.' });
      }

      // Generate a JWT magic link token (short-lived, 15 min)
      const token = jwt.sign(
        { userId: user.id, type: 'magic_link' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_MAGIC_LINK_EXPIRY || '15m' }
      );

      const verifyUrl = `${process.env.API_URL}/api/auth/verify/${token}`;

      logger.info('Magic link generated', { userId: user.id, verify_url: verifyUrl });

      // In production you'd send this via email/SMS; for now return it
      res.json({
        message: 'Magic link generated. Check your phone/email.',
        ...(process.env.NODE_ENV !== 'production' && { verify_url: verifyUrl, token }),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/auth/verify/:token
 * Validates the magic link JWT, creates a session, sets HttpOnly cookie,
 * and redirects to the dashboard.
 */
router.get('/verify/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired magic link.' });
    }

    if (payload.type !== 'magic_link') {
      return res.status(401).json({ error: 'Invalid token type.' });
    }

    // Create a long-lived session token
    const sessionToken = randomToken();
    const tokenHash = sha256(sessionToken);
    await createSession(payload.userId, tokenHash);

    res.cookie('session_token', sessionToken, COOKIE_OPTIONS);

    logger.info('User logged in via magic link', { userId: payload.userId });

    res.redirect(`${process.env.APP_URL}/dashboard`);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Clears the session from DB and removes the cookie.
 */
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.session_token;
    if (token) {
      const tokenHash = sha256(token);
      await deleteSession(tokenHash);
    }
    res.clearCookie('session_token');
    res.json({ message: 'Logged out.' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user.
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/demo
 * Sets a mock session for demo users (dev/staging only).
 */
router.post(
  '/demo',
  [
    body('platform').isIn(['whatsapp', 'telegram']),
    body('name').isString().trim().notEmpty(),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Demo login not available in production.' });
      }

      const { platform, name, plan = 'free' } = req.body;
      const platformUserId = `demo_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

      const user = await upsertUser(platform, platformUserId, { name });

      const sessionToken = randomToken();
      const tokenHash = sha256(sessionToken);
      await createSession(user.id, tokenHash);

      res.cookie('session_token', sessionToken, COOKIE_OPTIONS);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

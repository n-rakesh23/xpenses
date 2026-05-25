const { sha256 } = require('../utils/crypto');
const { getSessionByTokenHash } = require('../db/queries');
const logger = require('../utils/logger');

/**
 * JWT session validation middleware.
 * Reads the session_token cookie, hashes it, looks up the session in DB,
 * and attaches the user object to req.user.
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies.session_token;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const tokenHash = sha256(token);
    const session = await getSessionByTokenHash(tokenHash);

    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    req.user = {
      id: session.user_id,
      platform: session.platform,
      platform_user_id: session.platform_user_id,
      phone: session.phone,
      name: session.name,
      plan: session.plan,
      plan_expires_at: session.plan_expires_at,
    };

    next();
  } catch (err) {
    logger.error('Auth middleware error', { message: err.message });
    next(err);
  }
}

module.exports = { requireAuth };

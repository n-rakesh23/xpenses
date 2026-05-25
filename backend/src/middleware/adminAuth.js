const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Admin JWT middleware. Reads Authorization: Bearer <token> header.
 * Token is issued by POST /admin/auth/login using ADMIN_USERNAME + ADMIN_PASSWORD env vars.
 */
function requireAdmin(req, res, next) {
  try {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Admin token required' });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.admin = payload;
    next();
  } catch (err) {
    logger.warn('Admin auth failed', { message: err.message });
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}

module.exports = { requireAdmin };

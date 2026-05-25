const { validationResult } = require('express-validator');

/**
 * Middleware that reads express-validator results and returns 422 if any errors.
 * Always attach this after your validation chain.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

module.exports = { handleValidationErrors };

const { ApiError } = require('./errorHandler');

/**
 * Ensures required fields are present and non-empty on req.body.
 * Usage: requireFields('name', 'email', 'password')
 */
function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => {
      const val = req.body[f];
      return val === undefined || val === null || val === '';
    });
    if (missing.length > 0) {
      return next(new ApiError(400, `Missing required field(s): ${missing.join(', ')}`));
    }
    next();
  };
}

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

module.exports = { requireFields, isValidEmail };

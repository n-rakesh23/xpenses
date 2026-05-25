const crypto = require('crypto');

/**
 * Compute HMAC-SHA256 of data using key.
 * @param {string|Buffer} data
 * @param {string} key
 * @returns {string} hex digest
 */
function hmacSha256(data, key) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Verify HMAC-SHA256 signature.
 * @param {string|Buffer} data
 * @param {string} key
 * @param {string} signature - hex string to compare against
 * @returns {boolean}
 */
function verifyHmacSha256(data, key, signature) {
  const expected = hmacSha256(data, key);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Hash a string with SHA-256.
 * @param {string} data
 * @returns {string} hex digest
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a cryptographically random hex token.
 * @param {number} bytes - number of random bytes (default 32)
 * @returns {string} hex token
 */
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { hmacSha256, verifyHmacSha256, sha256, randomToken };

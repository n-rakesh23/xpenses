const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

// Cloudinary is configured via CLOUDINARY_URL env var automatically
// when the env var is set, no manual config needed.

/**
 * Upload a receipt image to Cloudinary.
 * @param {Buffer|string} fileData - file buffer or local path
 * @param {string} userId - used to organise uploads in a folder
 * @returns {Promise<{ url: string, publicId: string }>}
 */
async function uploadReceipt(fileData, userId) {
  const result = await cloudinary.uploader.upload(fileData, {
    folder: `xpense/receipts/${userId}`,
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
    transformation: [
      { quality: 'auto', fetch_format: 'auto' },
      { width: 1200, crop: 'limit' },
    ],
  });

  logger.info('Receipt uploaded to Cloudinary', { publicId: result.public_id, userId });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

/**
 * Upload a file from a URL (e.g., Telegram photo URL).
 * @param {string} fileUrl - public URL of the file
 * @param {string} userId
 * @returns {Promise<{ url: string, publicId: string }>}
 */
async function uploadReceiptFromUrl(fileUrl, userId) {
  return uploadReceipt(fileUrl, userId);
}

/**
 * Delete a receipt from Cloudinary.
 * @param {string} publicId
 * @returns {Promise<void>}
 */
async function deleteReceipt(publicId) {
  await cloudinary.uploader.destroy(publicId);
  logger.info('Receipt deleted from Cloudinary', { publicId });
}

/**
 * Get a signed URL for a receipt (if private).
 * @param {string} publicId
 * @returns {string} signed URL
 */
function getSignedUrl(publicId) {
  return cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    type: 'upload',
  });
}

module.exports = { uploadReceipt, uploadReceiptFromUrl, deleteReceipt, getSignedUrl };

/**
 * Format a number as Indian Rupee currency string.
 * @param {number} amount
 * @returns {string} e.g. "₹1,200.50"
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a Date or date string to a human-readable date.
 * @param {Date|string} date
 * @returns {string} e.g. "15 Jan 2024"
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date));
}

/**
 * Format a Date or date string to a human-readable datetime.
 * @param {Date|string} date
 * @returns {string} e.g. "15 Jan 2024, 10:30 AM"
 */
function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date));
}

/**
 * Get the start and end date strings for a given week offset.
 * @param {number} weeksAgo - 0 = current week
 * @returns {{ start: string, end: string }}
 */
function getWeekRange(weeksAgo = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek - weeksAgo * 7);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return {
    start: formatDate(startOfWeek),
    end: formatDate(endOfWeek),
  };
}

module.exports = { formatCurrency, formatDate, formatDateTime, getWeekRange };

require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });

// Default test environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://xpense:xpense@localhost:5432/xpense_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jest-only';
process.env.JWT_MAGIC_LINK_EXPIRY = '15m';
process.env.JWT_SESSION_EXPIRY = '7d';
process.env.APP_URL = 'http://localhost:5173';
process.env.META_VERIFY_TOKEN = 'test-verify-token';
process.env.META_APP_SECRET = 'test-app-secret';
process.env.TELEGRAM_SECRET_TOKEN = 'test-telegram-secret';

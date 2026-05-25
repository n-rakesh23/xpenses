-- Xpense Database Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- users
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        VARCHAR(20) NOT NULL CHECK (platform IN ('whatsapp','telegram')),
  platform_user_id VARCHAR(100) NOT NULL,
  phone           VARCHAR(20),
  name            VARCHAR(100),
  plan            VARCHAR(10) NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  plan_expires_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, platform_user_id)
);
CREATE INDEX IF NOT EXISTS idx_users_platform_id ON users(platform, platform_user_id);

-- expenses
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0 AND amount <= 100000),
  category    VARCHAR(20) NOT NULL CHECK (category IN
              ('food','transport','shopping','entertainment','health','other')),
  description TEXT,
  note        TEXT,
  receipt_url TEXT,
  message_id  VARCHAR(100),
  platform    VARCHAR(20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_created ON expenses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id, category);

-- conversation_state
CREATE TABLE IF NOT EXISTS conversation_state (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state            VARCHAR(30) NOT NULL DEFAULT 'idle',
  pending_category VARCHAR(20),
  pending_expense_id UUID REFERENCES expenses(id),
  context          JSONB,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
);

-- sessions
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

-- budgets
CREATE TABLE IF NOT EXISTS budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      VARCHAR(20) NOT NULL,
  monthly_limit NUMERIC(10,2) NOT NULL CHECK (monthly_limit > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category)
);

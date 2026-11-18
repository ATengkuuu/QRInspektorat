-- PostgreSQL schema converted from ../database.sql.
-- Run this file once in the Supabase SQL Editor. It does not drop or reset data.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  date_of_birth DATE,
  job_field VARCHAR(150) NOT NULL DEFAULT '',
  profile_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  image TEXT,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_location ON products (location);
CREATE INDEX IF NOT EXISTS idx_products_timestamp ON products (timestamp);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('add', 'download_qr', 'delete', 'update')),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255),
  user_name VARCHAR(100),
  user_field VARCHAR(150),
  product_location VARCHAR(255),
  product_quantity INTEGER,
  details VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_user_created ON activity_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_product ON activity_logs (product_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  otp_verified_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  invalidated_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_reset_tokens_attempt_count_check CHECK (attempt_count >= 0 AND attempt_count <= max_attempts),
  CONSTRAINT password_reset_tokens_max_attempts_check CHECK (max_attempts = 5)
);

CREATE INDEX IF NOT EXISTS idx_reset_email_created
  ON password_reset_tokens (email, created_at);

CREATE TABLE IF NOT EXISTS password_reset_rate_limits (
  scope VARCHAR(10) NOT NULL,
  identifier_hash CHAR(64) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, identifier_hash),
  CONSTRAINT password_reset_rate_limits_scope_check CHECK (scope IN ('email', 'ip')),
  CONSTRAINT password_reset_rate_limits_count_check CHECK (request_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_rate_limits_window
  ON password_reset_rate_limits (window_started_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- DESIGN ONLY: do not run this file yet.
-- This draft is for a future transactional outbox implementation.
-- It is intentionally separate from schema.sql and migration_existing_database.sql.

CREATE TABLE IF NOT EXISTS password_reset_email_outbox (
  id UUID PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES password_reset_tokens(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  code_encrypted TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reset_outbox_token
  ON password_reset_email_outbox (token_id);

CREATE INDEX IF NOT EXISTS idx_reset_outbox_pending
  ON password_reset_email_outbox (status, available_at);

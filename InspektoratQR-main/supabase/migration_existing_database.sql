-- Completes an existing Supabase schema without deleting tables or data.
-- Audit result: columns, constraints, foreign keys, unique constraints, checks,
-- and indexes already match supabase/schema.sql. The missing items were the
-- OTP verification marker, attempt counters, updated_at triggers, and
-- timestamptz types on the reset-token timestamps.
-- expires_at and used_at are normalized from timestamp without time zone to
-- timestamptz when needed; existing values are interpreted as UTC.
-- Review this file before running it in the Supabase SQL Editor.

DO $$
DECLARE
  column_name text;
  column_type text;
BEGIN
  IF to_regclass('public.password_reset_tokens') IS NULL THEN
    RAISE EXCEPTION 'Required table public.password_reset_tokens does not exist';
  END IF;

  ALTER TABLE public.password_reset_tokens
    ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz;

  ALTER TABLE public.password_reset_tokens
    ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

  ALTER TABLE public.password_reset_tokens
    ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5;

  ALTER TABLE public.password_reset_tokens
    ADD COLUMN IF NOT EXISTS invalidated_at timestamptz;

  IF EXISTS (
    SELECT 1
    FROM public.password_reset_tokens
    WHERE attempt_count IS NULL
       OR max_attempts IS NULL
       OR attempt_count < 0
       OR attempt_count > max_attempts
       OR max_attempts <> 5
  ) THEN
    RAISE EXCEPTION 'Invalid password_reset_tokens attempt data: attempt_count must be between 0 and max_attempts, and max_attempts must equal 5';
  END IF;

  ALTER TABLE public.password_reset_tokens
    ALTER COLUMN attempt_count SET DEFAULT 0,
    ALTER COLUMN attempt_count SET NOT NULL,
    ALTER COLUMN max_attempts SET DEFAULT 5,
    ALTER COLUMN max_attempts SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'password_reset_tokens_attempt_count_check'
      AND conrelid = 'public.password_reset_tokens'::regclass
  ) THEN
    ALTER TABLE public.password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_attempt_count_check
      CHECK (attempt_count >= 0 AND attempt_count <= max_attempts);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'password_reset_tokens_max_attempts_check'
      AND conrelid = 'public.password_reset_tokens'::regclass
  ) THEN
    ALTER TABLE public.password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_max_attempts_check
      CHECK (max_attempts = 5);
  END IF;

  FOREACH column_name IN ARRAY ARRAY['expires_at', 'used_at']
  LOOP
    SELECT t.typname
    INTO column_type
    FROM pg_attribute a
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE a.attrelid = 'public.password_reset_tokens'::regclass
      AND a.attname = column_name
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF column_type IS NULL THEN
      RAISE EXCEPTION 'Required column public.password_reset_tokens.% does not exist', column_name;
    ELSIF column_type = 'timestamptz' THEN
      CONTINUE;
    ELSIF column_type = 'timestamp' THEN
      EXECUTE format(
        'ALTER TABLE public.password_reset_tokens ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE %L',
        column_name,
        column_name,
        'UTC'
      );
    ELSE
      RAISE EXCEPTION 'Column public.password_reset_tokens.% has type %, expected timestamp or timestamptz', column_name, column_type;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.password_reset_rate_limits (
  scope VARCHAR(10) NOT NULL,
  identifier_hash CHAR(64) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, identifier_hash),
  CONSTRAINT password_reset_rate_limits_scope_check CHECK (scope IN ('email', 'ip')),
  CONSTRAINT password_reset_rate_limits_count_check CHECK (request_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_rate_limits_window
  ON public.password_reset_rate_limits (window_started_at);

DO $$
DECLARE
  existing_trigger record;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Required table public.users does not exist';
  END IF;

  SELECT t.tgtype, t.tgenabled, t.tgfoid AS function_oid
  INTO existing_trigger
  FROM pg_trigger t
  WHERE t.tgname = 'users_set_updated_at'
    AND t.tgrelid = 'public.users'::regclass
    AND NOT t.tgisinternal;

  IF FOUND THEN
    IF existing_trigger.tgtype <> 19
       OR existing_trigger.tgenabled <> 'O'
       OR existing_trigger.function_oid <> 'public.set_updated_at()'::regprocedure THEN
      RAISE EXCEPTION 'Existing trigger public.users.users_set_updated_at has an unexpected catalog definition';
    END IF;
  ELSE
    CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

DO $$
DECLARE
  existing_trigger record;
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE EXCEPTION 'Required table public.products does not exist';
  END IF;

  SELECT t.tgtype, t.tgenabled, t.tgfoid AS function_oid
  INTO existing_trigger
  FROM pg_trigger t
  WHERE t.tgname = 'products_set_updated_at'
    AND t.tgrelid = 'public.products'::regclass
    AND NOT t.tgisinternal;

  IF FOUND THEN
    IF existing_trigger.tgtype <> 19
       OR existing_trigger.tgenabled <> 'O'
       OR existing_trigger.function_oid <> 'public.set_updated_at()'::regprocedure THEN
      RAISE EXCEPTION 'Existing trigger public.products.products_set_updated_at has an unexpected catalog definition';
    END IF;
  ELSE
    CREATE TRIGGER products_set_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

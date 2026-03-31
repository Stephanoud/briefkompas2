CREATE TABLE IF NOT EXISTS saved_letters (
  id UUID PRIMARY KEY,
  recovery_token_hash TEXT NOT NULL UNIQUE,
  document_payload JSONB NOT NULL,
  generated_letter TEXT NOT NULL,
  research_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consent_storage BOOLEAN NOT NULL DEFAULT TRUE,
  consent_research BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  CONSTRAINT saved_letters_status_check CHECK (status IN ('active', 'expired', 'deleted')),
  CONSTRAINT saved_letters_storage_check CHECK (consent_storage = TRUE)
);

CREATE INDEX IF NOT EXISTS saved_letters_status_expires_idx
  ON saved_letters (status, expires_at);

CREATE INDEX IF NOT EXISTS saved_letters_created_at_idx
  ON saved_letters (created_at DESC);

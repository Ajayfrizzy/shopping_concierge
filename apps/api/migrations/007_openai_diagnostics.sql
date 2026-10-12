-- Separate metadata only; no modification of reservations or historical usage.
CREATE TABLE openai_provider_diagnostics (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  session_id text NOT NULL CHECK(length(session_id) BETWEEN 1 AND 200),
  client_request_id text CHECK(length(client_request_id) BETWEEN 1 AND 200),
  ledger_reservation_id uuid UNIQUE,
  stage text NOT NULL CHECK(stage IN ('reservation','transport','http','response_json','settlement','response_shape','plan_schema')),
  http_status integer CHECK(http_status BETWEEN 100 AND 599),
  error_code text,
  error_type text,
  provider_request_id text CHECK(provider_request_id ~ '^req_[a-zA-Z0-9_-]{1,128}$'),
  aborted boolean NOT NULL DEFAULT false,
  outcome text NOT NULL CHECK(outcome IN ('pending','success','failure'))
);
CREATE INDEX openai_diagnostics_session_created ON openai_provider_diagnostics(session_id,created_at);
CREATE INDEX openai_diagnostics_client_request ON openai_provider_diagnostics(client_request_id);
-- No FK to shopping_sessions: a diagnostic must survive a rolled-back shopping transaction.

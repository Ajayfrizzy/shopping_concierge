CREATE TABLE IF NOT EXISTS principals (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  email text
);
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  product jsonb NOT NULL CHECK (product->>'id' = id)
);
CREATE TABLE IF NOT EXISTS shopping_sessions (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES principals(id),
  version bigint NOT NULL CHECK (version >= 0),
  record jsonb NOT NULL CHECK (record->'view'->'state'->>'id' = id::text),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_owner ON shopping_sessions(owner_id);
CREATE INDEX IF NOT EXISTS principals_email ON principals(email);
CREATE TABLE IF NOT EXISTS product_feedback (
  session_id uuid NOT NULL REFERENCES shopping_sessions(id),
  sequence integer NOT NULL,
  product_id text NOT NULL REFERENCES products(id),
  feedback jsonb NOT NULL,
  PRIMARY KEY (session_id, sequence)
);
CREATE TABLE IF NOT EXISTS saved_products (
  session_id uuid NOT NULL REFERENCES shopping_sessions(id),
  product_id text NOT NULL REFERENCES products(id),
  PRIMARY KEY (session_id, product_id)
);
CREATE TABLE IF NOT EXISTS agent_events (
  session_id uuid NOT NULL REFERENCES shopping_sessions(id),
  revision bigint NOT NULL,
  event jsonb NOT NULL,
  PRIMARY KEY (session_id, revision)
);
CREATE TABLE IF NOT EXISTS visual_assets (
  session_id uuid NOT NULL REFERENCES shopping_sessions(id),
  id uuid NOT NULL,
  asset jsonb NOT NULL,
  object_key text NOT NULL UNIQUE,
  PRIMARY KEY (session_id, id)
);
CREATE TABLE IF NOT EXISTS email_challenges (
  hash text PRIMARY KEY,
  owner_id text NOT NULL UNIQUE REFERENCES principals(id),
  email text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL
);

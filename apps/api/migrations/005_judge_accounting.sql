-- Judge accounting is separate from immutable validation evidence (migration 004/file ledger).
CREATE TABLE runtime_budgets (
  provider text PRIMARY KEY CHECK(provider IN ('openai','youcam')),
  max_requests integer NOT NULL CHECK(max_requests>0),
  max_units integer NOT NULL CHECK(max_units>=0),
  max_usd numeric(16,8) NOT NULL CHECK(max_usd>=0),
  approved boolean NOT NULL DEFAULT false,
  blocked boolean NOT NULL DEFAULT false
);
INSERT INTO runtime_budgets VALUES ('youcam',50,50,0,true,false),('openai',200,0,3,false,false);
CREATE TABLE runtime_usage (
  provider text NOT NULL REFERENCES runtime_budgets(provider),
  id uuid NOT NULL,
  category text CHECK(category IN ('earrings','necklaces','rings','watches')),
  units integer NOT NULL CHECK(units>=0),
  reserved_usd numeric(16,8) NOT NULL CHECK(reserved_usd>=0),
  charged_usd numeric(16,8) NOT NULL CHECK(charged_usd>=0),
  usage jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  PRIMARY KEY(provider,id)
);

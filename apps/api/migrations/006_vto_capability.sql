-- Eligibility is explicit and defaults off; private asset keys never enter public product JSON.
CREATE TABLE product_vto_assets (
  product_id text PRIMARY KEY REFERENCES products(id),
  object_key text NOT NULL UNIQUE CHECK(length(object_key)>0),
  sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
  approved_at timestamptz NOT NULL DEFAULT now()
);

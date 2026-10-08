-- One account-wide budget. Never reset this row or its reservations on redeploy.
CREATE TABLE youcam_usage_budget (
  id integer PRIMARY KEY CHECK (id=1),
  max_requests integer NOT NULL CHECK (max_requests>0),
  max_units integer NOT NULL CHECK (max_units>0)
);
INSERT INTO youcam_usage_budget VALUES (1,8,8);
CREATE TABLE youcam_usage_reservations (
  id text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('earrings','necklaces','rings','watches')),
  units integer NOT NULL DEFAULT 1 CHECK (units=1),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  historical boolean NOT NULL DEFAULT false
);
-- Five recorded validation renders, each observed to consume one unit.
-- No provider credentials, images, URLs or response bodies are stored here.
INSERT INTO youcam_usage_reservations (id,category,reserved_at,committed_at,historical) VALUES ('validation-2026-10-07-1','earrings','2026-10-07T06:00:20.917Z','2026-10-07T06:00:20.917Z',true);
INSERT INTO youcam_usage_reservations (id,category,reserved_at,committed_at,historical) VALUES ('validation-2026-10-07-2','necklaces','2026-10-07T06:18:26.670Z','2026-10-07T06:18:26.670Z',true);
INSERT INTO youcam_usage_reservations (id,category,reserved_at,committed_at,historical) VALUES ('validation-2026-10-07-3','rings','2026-10-07T06:28:59.061Z','2026-10-07T06:28:59.061Z',true);
INSERT INTO youcam_usage_reservations (id,category,reserved_at,committed_at,historical) VALUES ('validation-2026-10-07-4','watches','2026-10-07T06:42:57.860Z','2026-10-07T06:42:57.860Z',true);
INSERT INTO youcam_usage_reservations (id,category,reserved_at,committed_at,historical) VALUES ('validation-2026-10-07-5','necklaces','2026-10-07T10:59:55.547Z','2026-10-07T10:59:55.547Z',true);

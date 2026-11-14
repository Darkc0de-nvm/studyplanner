CREATE TABLE IF NOT EXISTS disciplines (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  color_index SMALLINT    NOT NULL DEFAULT 1 CHECK (color_index BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_disciplines_user_lower_name
  ON disciplines(user_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_disciplines_user ON disciplines(user_id);

CREATE TABLE IF NOT EXISTS tasks (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discipline_id UUID         NOT NULL REFERENCES disciplines(id) ON DELETE RESTRICT,
  title         VARCHAR(100) NOT NULL CHECK (char_length(trim(title)) >= 3),
  description   TEXT         CHECK (char_length(description) <= 500),
  deadline      DATE         NOT NULL,
  done          BOOLEAN      NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_deadline ON tasks(user_id, deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_user_done      ON tasks(user_id, done);
CREATE INDEX IF NOT EXISTS idx_tasks_discipline_id  ON tasks(discipline_id);

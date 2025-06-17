CREATE TABLE IF NOT EXISTS users (
    user_id   SERIAL PRIMARY KEY,
    user_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id                   SERIAL PRIMARY KEY,
    user_id              INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    text                 TEXT NOT NULL,
    category             TEXT,
    scheduled_at         TIMESTAMP,
    place                TEXT,
    is_completed         BOOLEAN DEFAULT false,
    activation_condition JSONB
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);

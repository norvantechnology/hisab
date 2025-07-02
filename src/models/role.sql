CREATE TABLE IF NOT EXISTS hisab.roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Insert Default Roles with schema prefix
INSERT INTO hisab.roles (name) VALUES ('admin') ON CONFLICT (name) DO NOTHING;
INSERT INTO hisab.roles (name) VALUES ('user') ON CONFLICT (name) DO NOTHING;

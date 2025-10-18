-- Migration: Add invite code authentication system

-- Create invite codes table
CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'trainee' CHECK (role IN ('admin', 'trainer', 'trainee')),
    department TEXT,
    is_used BOOLEAN DEFAULT 0,
    used_by INTEGER,
    used_at DATETIME,
    expires_at DATETIME,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (used_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Add password_hash and invite_code_id to users table
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN invite_code_id INTEGER REFERENCES invite_codes(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_used ON invite_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires ON invite_codes(expires_at);

-- Note: Admin invite code is generated at runtime on first startup
-- See server/index.js generateInitialAdminCode() function
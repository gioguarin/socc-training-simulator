-- Migration: Add Offline Mode Support
-- Allows admins/trainers to create offline training sessions

-- Offline Sessions
CREATE TABLE IF NOT EXISTS offline_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_name TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    scenario_id TEXT,
    status TEXT DEFAULT 'preparing', -- preparing, active, completed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Offline Players
CREATE TABLE IF NOT EXISTS offline_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    role TEXT, -- caller or responder (assigned when session starts)
    access_code TEXT UNIQUE, -- unique code for player to access their assignment
    paired_with INTEGER, -- ID of the other player they're paired with
    assignment_viewed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES offline_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (paired_with) REFERENCES offline_players(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offline_sessions_creator ON offline_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_offline_sessions_status ON offline_sessions(status);
CREATE INDEX IF NOT EXISTS idx_offline_players_session ON offline_players(session_id);
CREATE INDEX IF NOT EXISTS idx_offline_players_access_code ON offline_players(access_code);

-- Add offline_session_id to game_sessions for tracking
ALTER TABLE game_sessions ADD COLUMN offline_session_id INTEGER REFERENCES offline_sessions(id);

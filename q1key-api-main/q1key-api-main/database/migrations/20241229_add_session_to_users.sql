-- Migration: Add active_session_id to users table for single session enforcement
-- Date: 2024-12-29

-- Add active_session_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_id VARCHAR(255);

-- Add index for faster session lookup
CREATE INDEX IF NOT EXISTS idx_users_active_session_id ON users(active_session_id);

-- Comment explaining the column
COMMENT ON COLUMN users.active_session_id IS 'Tracks the currently active session ID. Only one session allowed per user.';

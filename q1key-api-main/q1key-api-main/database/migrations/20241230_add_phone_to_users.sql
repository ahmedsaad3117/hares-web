-- Migration: Add phone_number to users table
-- Date: 2024-12-30

-- Add phone_number column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50) UNIQUE;

-- Add index for faster phone lookup
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

-- Comment explaining the column
COMMENT ON COLUMN users.phone_number IS 'User phone number for login and contact. Must be unique.';

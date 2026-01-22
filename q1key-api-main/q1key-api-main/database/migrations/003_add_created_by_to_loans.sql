-- Migration: Add created_by to loans table
-- Description: Track which user gave/created each loan

-- Add created_by column to loans table
ALTER TABLE loans ADD COLUMN created_by INTEGER;

-- Add foreign key constraint to users table
ALTER TABLE loans ADD CONSTRAINT fk_loans_creator 
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- Backfill existing loans with super admin user (user_id = 1)
-- This ensures all existing records have a valid creator
UPDATE loans SET created_by = 1 WHERE created_by IS NULL;

-- Add index for better query performance
CREATE INDEX idx_loans_created_by ON loans(created_by);

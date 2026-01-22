-- Migration: Add tax_id, phone_number, email, and can_create_branches to institutions table
-- Date: 2025-12-28

-- Add new columns to institutions table
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS tax_id VARCHAR(100);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS can_create_branches BOOLEAN DEFAULT TRUE;

-- Update existing records to have can_create_branches = true
UPDATE institutions SET can_create_branches = TRUE WHERE can_create_branches IS NULL;

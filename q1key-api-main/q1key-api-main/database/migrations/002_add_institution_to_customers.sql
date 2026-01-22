-- Migration: Add institution_id and created_by to customers table
-- Created: 2025-12-26

-- Add institution_id column (nullable initially)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS institution_id INTEGER;

-- Add created_by column (nullable initially)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS created_by INTEGER;

-- Add foreign key constraints
ALTER TABLE customers 
ADD CONSTRAINT IF NOT EXISTS fk_customers_institution 
FOREIGN KEY (institution_id) REFERENCES institutions(institution_id) ON DELETE SET NULL;

ALTER TABLE customers 
ADD CONSTRAINT IF NOT EXISTS fk_customers_creator 
FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- Update existing customers with institution_id from first institution (if exists)
UPDATE customers 
SET institution_id = (SELECT institution_id FROM institutions ORDER BY institution_id LIMIT 1)
WHERE institution_id IS NULL;

-- Update existing customers with created_by from first super admin (if exists)
UPDATE customers 
SET created_by = (SELECT user_id FROM users u JOIN roles r ON u.role_id = r.role_id WHERE r.role_name = 'Super Admin' ORDER BY user_id LIMIT 1)
WHERE created_by IS NULL;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'customers' AND column_name IN ('institution_id', 'created_by');

-- Migration: Add trust_status column to customers table
-- Created: 2025-12-26

-- Add trust_status enum type (if PostgreSQL doesn't have it yet)
DO $$ BEGIN
    CREATE TYPE trust_status_enum AS ENUM ('Unverified', 'Trusted', 'Suspicious', 'Flagged', 'Blocked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add trust_status column to customers table with default value
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS trust_status trust_status_enum NOT NULL DEFAULT 'Unverified';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'customers' AND column_name = 'trust_status';

-- Migration: Add phone_number and email to branches table
-- Date: 2025-12-28

-- Add new columns to branches table
ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS email VARCHAR(255);

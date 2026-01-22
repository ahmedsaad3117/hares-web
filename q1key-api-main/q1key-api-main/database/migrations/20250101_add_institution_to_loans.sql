-- Migration: Add institution_id to loans and make branch_id optional
-- Date: 2025-01-01
-- Description: Allow loans to be associated with institutions that don't have branches

-- Step 1: Add institution_id column to loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS institution_id INTEGER;

-- Step 2: Add foreign key constraint for institution_id
ALTER TABLE loans ADD CONSTRAINT fk_loans_institution 
    FOREIGN KEY (institution_id) REFERENCES institutions(institution_id);

-- Step 3: Make branch_id nullable (optional)
ALTER TABLE loans ALTER COLUMN branch_id DROP NOT NULL;

-- Step 4: Add check constraint to ensure either branch_id OR institution_id is set
ALTER TABLE loans ADD CONSTRAINT chk_loans_branch_or_institution 
    CHECK (
        (branch_id IS NOT NULL AND institution_id IS NULL) OR 
        (branch_id IS NULL AND institution_id IS NOT NULL)
    );

-- Note: Existing loans already have branch_id set and institution_id is NULL, 
-- so they satisfy the constraint. No data migration needed.

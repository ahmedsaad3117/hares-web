-- Migration: Add institution_id and branch_id to products table
-- Date: 2025-12-26

-- Add institution_id and branch_id columns
ALTER TABLE products
ADD COLUMN institution_id INTEGER,
ADD COLUMN branch_id INTEGER;

-- Add foreign key constraints
ALTER TABLE products
ADD CONSTRAINT fk_products_institution
FOREIGN KEY (institution_id) REFERENCES institutions(institution_id) ON DELETE CASCADE;

ALTER TABLE products
ADD CONSTRAINT fk_products_branch
FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_products_institution_id ON products(institution_id);
CREATE INDEX idx_products_branch_id ON products(branch_id);

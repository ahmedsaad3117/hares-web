-- Migration: Add payment plan to loans table
-- Date: 2025-12-26

ALTER TABLE loans 
ADD COLUMN payment_plan_months INTEGER NOT NULL DEFAULT 1 CHECK (payment_plan_months >= 1 AND payment_plan_months <= 12),
ADD COLUMN paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

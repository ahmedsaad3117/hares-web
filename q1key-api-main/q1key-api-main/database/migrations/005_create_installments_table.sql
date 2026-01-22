-- Migration: Create installments table
-- Date: 2025-12-26

CREATE TABLE installments (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  payment_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_installments_loan 
    FOREIGN KEY (loan_id) 
    REFERENCES loans(loan_id) 
    ON DELETE CASCADE
);

CREATE INDEX idx_installments_loan_id ON installments(loan_id);
CREATE INDEX idx_installments_due_date ON installments(due_date);
CREATE INDEX idx_installments_status ON installments(status);

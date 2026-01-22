-- Hares Platform PostgreSQL Database Schema
-- This schema is generated to match all TypeORM entities exactly

-- ============================================================================
-- TABLE CREATION
-- ============================================================================

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create institutions table
CREATE TABLE IF NOT EXISTS institutions (
    institution_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(100),
    phone_number VARCHAR(50),
    email VARCHAR(255),
    max_users INTEGER NOT NULL DEFAULT 5,
    can_create_branches BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    expiration_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
    branch_id SERIAL PRIMARY KEY,
    institution_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    total_loans INTEGER DEFAULT 0,
    maximum_loans INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(institution_id) ON DELETE CASCADE
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL,
    institution_id INTEGER,
    branch_id INTEGER,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    FOREIGN KEY (institution_id) REFERENCES institutions(institution_id) ON DELETE SET NULL,
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE SET NULL
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    institution_id INTEGER,
    created_by INTEGER,
    name VARCHAR(255) NOT NULL,
    national_id VARCHAR(50) NOT NULL UNIQUE,
    phone_number VARCHAR(50) NOT NULL UNIQUE,
    trust_status VARCHAR(20) DEFAULT 'Unverified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(institution_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_trust_status CHECK (trust_status IN ('Unverified', 'Trusted', 'Suspicious', 'Flagged', 'Blocked'))
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    institution_id INTEGER,
    branch_id INTEGER,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(institution_id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE CASCADE
);

-- Create loans table
CREATE TABLE IF NOT EXISTS loans (
    loan_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    branch_id INTEGER,
    institution_id INTEGER,
    product_id INTEGER NOT NULL,
    principal_amount DECIMAL(10, 2) NOT NULL,
    created_by INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    payment_plan_months INTEGER DEFAULT 1,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(branch_id),
    FOREIGN KEY (institution_id) REFERENCES institutions(institution_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_status CHECK (status IN ('Active', 'Paid', 'Late', 'Finished')),
    CONSTRAINT chk_payment_plan_months CHECK (payment_plan_months >= 1 AND payment_plan_months <= 12),
    CONSTRAINT chk_branch_or_institution CHECK (
        (branch_id IS NOT NULL AND institution_id IS NULL) OR 
        (branch_id IS NULL AND institution_id IS NOT NULL)
    )
);

-- Create installments table
CREATE TABLE IF NOT EXISTS installments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending',
    payment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(loan_id) ON DELETE CASCADE,
    CONSTRAINT chk_installment_status CHECK (status IN ('Pending', 'Paid', 'Overdue', 'Cancelled')),
    CONSTRAINT chk_installment_number CHECK (installment_number >= 1)
);

-- Create search_logs table
CREATE TABLE IF NOT EXISTS search_logs (
    search_log_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    search_query VARCHAR(500) NOT NULL,
    search_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_institution_id ON users(institution_id);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_national_id ON customers(national_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone_number ON customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_institution_id ON customers(institution_id);
CREATE INDEX IF NOT EXISTS idx_customers_trust_status ON customers(trust_status);
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON customers(created_by);

-- Branches indexes
CREATE INDEX IF NOT EXISTS idx_branches_institution_id ON branches(institution_id);

-- Loans indexes
CREATE INDEX IF NOT EXISTS idx_loans_customer_id ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_branch_id ON loans(branch_id);
CREATE INDEX IF NOT EXISTS idx_loans_product_id ON loans(product_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_created_by ON loans(created_by);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);

-- Installments indexes
CREATE INDEX IF NOT EXISTS idx_installments_loan_id ON installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);

-- Search logs indexes
CREATE INDEX IF NOT EXISTS idx_search_logs_customer_id ON search_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_institution_id ON products(institution_id);
CREATE INDEX IF NOT EXISTS idx_products_branch_id ON products(branch_id);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default roles
INSERT INTO roles (role_name) VALUES 
    ('Super Admin'),
    ('Institution'),
    ('Branch')
ON CONFLICT (role_name) DO NOTHING;

-- Insert default Super Admin user
-- Password: admin123 (bcrypt hash - you must update this with actual hash)
INSERT INTO users (name, email, password_hash, role_id) VALUES 
    ('Super Admin', 'admin@example.com', '$2b$10$YourActualBcryptHashHere', 1)
ON CONFLICT (email) DO NOTHING;

-- Optional: Insert sample institution (comment out if not needed)
-- INSERT INTO institutions (institution_id, name, max_users) VALUES 
--     (1, 'Main Financial Institution', 100)
-- ON CONFLICT (institution_id) DO NOTHING;

-- Optional: Insert sample branch (comment out if not needed)
-- INSERT INTO branches (branch_id, name, institution_id) VALUES 
--     (1, 'Downtown Branch', 1)
-- ON CONFLICT (branch_id) DO NOTHING;

-- Optional: Insert sample customers (comment out if not needed)
-- INSERT INTO customers (name, national_id, phone_number) VALUES 
--     ('John Doe', '1234567890', '+1234567890'),
--     ('Jane Smith', '0987654321', '+0987654321')
-- ON CONFLICT (national_id) DO NOTHING;

-- Optional: Insert sample products (comment out if not needed)
-- INSERT INTO products (product_id, name, description, is_active) VALUES 
--     (1, 'Personal Loan', 'Short-term personal loan with flexible repayment', TRUE),
--     (2, 'Business Loan', 'Loan for small and medium businesses', TRUE),
--     (3, 'Home Loan', 'Long-term home financing solution', TRUE)
-- ON CONFLICT (product_id) DO NOTHING;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Entity mappings:
-- - roles -> Role entity (role_name column)
-- - institutions -> Institution entity (has expiration_date, max_users default 5)
-- - branches -> Branch entity (has is_active, total_loans, maximum_loans)
-- - users -> User entity (password_hash column)
-- - customers -> Customer entity (trust_status enum, institution_id, created_by)
-- - products -> Product entity (can belong to institution or branch)
-- - loans -> Loan entity (has payment_plan_months, paid_amount, created_by)
-- - installments -> Installment entity (status enum with Cancelled option)
-- - search_logs -> SearchLog entity (has search_query, search_type, ip_address)
--
-- Trust Status Values: Unverified, Trusted, Suspicious, Flagged, Blocked
-- Loan Status Values: Active, Paid, Late, Finished
-- Installment Status Values: Pending, Paid, Overdue, Cancelled
--
-- ============================================================================

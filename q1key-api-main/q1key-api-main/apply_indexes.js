/**
 * Database Performance Indexes - Comprehensive Script
 * 
 * This script adds critical indexes to improve query performance.
 * It is designed to be run safely on a live database without affecting existing data.
 * 
 * Usage: node apply_indexes.js
 * 
 * Analyzed Tables:
 * - loans: Most frequently queried table
 * - customers: Search and filtering
 * - installments: Status filtering and due dates
 * - cash_box_transactions: Report aggregations
 * - cash_boxes: Branch/Institution filtering
 * - customer_relations: Soft delete and linking
 * - branches: Institution lookup
 * - users: Authentication and filtering
 * - subscription_requests: Status filtering
 * - products: Lookup and filtering
 * - search_logs: Customer tracking
 */

const { Client } = require('pg');
require('dotenv').config();

// ===============================================
// INDEX DEFINITIONS
// ===============================================

const INDEXES = {
    // =====================
    // LOANS TABLE (HIGH PRIORITY)
    // Most frequently queried table in the system
    // =====================
    loans: [
        // Foreign Key Indexes for JOINs
        { name: 'IDX_loans_customer_id', column: 'customer_id', reason: 'JOIN with customers table' },
        { name: 'IDX_loans_branch_id', column: 'branch_id', reason: 'JOIN with branches, filtering by branch' },
        { name: 'IDX_loans_institution_id', column: 'institution_id', reason: 'JOIN with institutions, scope filtering' },
        { name: 'IDX_loans_product_id', column: 'product_id', reason: 'JOIN with products' },
        { name: 'IDX_loans_created_by', column: 'created_by', reason: 'JOIN with users' },

        // Status filtering (very frequent in reports)
        { name: 'IDX_loans_status', column: 'status', reason: 'Frequent filtering by loan status' },

        // Date sorting and filtering
        { name: 'IDX_loans_created_at', column: 'created_at DESC', reason: 'Sorting by creation date' },
        { name: 'IDX_loans_due_date', column: 'due_date', reason: 'Filtering by due date' },

        // Composite indexes for common query patterns
        { name: 'IDX_loans_institution_status', columns: ['institution_id', 'status'], reason: 'Reports: filter by institution and status' },
        { name: 'IDX_loans_branch_status', columns: ['branch_id', 'status'], reason: 'Reports: filter by branch and status' },
        { name: 'IDX_loans_institution_created_at', columns: ['institution_id', 'created_at DESC'], reason: 'Reports: institution with date range' },
    ],

    // =====================
    // CUSTOMERS TABLE (HIGH PRIORITY)
    // Search and linking operations
    // =====================
    customers: [
        // Unique search fields (already have unique constraint, but explicit index helps)
        { name: 'IDX_customers_national_id', column: 'national_id', reason: 'Exact search by national ID' },
        { name: 'IDX_customers_phone_number', column: 'phone_number', reason: 'Exact search by phone' },

        // Scope filtering
        { name: 'IDX_customers_institution_id', column: 'institution_id', reason: 'Filtering by institution' },
        { name: 'IDX_customers_created_by', column: 'created_by', reason: 'Filtering by creator' },

        // Sorting
        { name: 'IDX_customers_created_at', column: 'created_at DESC', reason: 'Sorting by creation date' },

        // Trust status filtering
        { name: 'IDX_customers_trust_status', column: 'trust_status', reason: 'Filtering by trust status' },
    ],

    // =====================
    // INSTALLMENTS TABLE (HIGH PRIORITY)
    // Frequent status checks and overdue queries
    // =====================
    installments: [
        // Foreign key for JOIN
        { name: 'IDX_installments_loan_id', column: 'loan_id', reason: 'JOIN with loans table' },

        // Status filtering (very frequent)
        { name: 'IDX_installments_status', column: 'status', reason: 'Filtering by payment status' },

        // Due date for overdue queries
        { name: 'IDX_installments_due_date', column: 'due_date', reason: 'Filtering by due date' },

        // Composite for overdue detection query
        { name: 'IDX_installments_status_due_date', columns: ['status', 'due_date'], reason: 'Finding overdue installments' },

        // Composite for loan lookup with status
        { name: 'IDX_installments_loan_status', columns: ['loan_id', 'status'], reason: 'Finding installments by loan and status' },
    ],

    // =====================
    // CASH_BOX_TRANSACTIONS TABLE (HIGH PRIORITY)
    // Report aggregations
    // =====================
    cash_box_transactions: [
        // Foreign key for JOIN
        { name: 'IDX_cbt_cash_box_id', column: 'cash_box_id', reason: 'JOIN with cash_boxes' },

        // Type filtering for reports
        { name: 'IDX_cbt_transaction_type', column: 'transaction_type', reason: 'Filtering by transaction type' },

        // Date sorting and filtering
        { name: 'IDX_cbt_created_at', column: 'created_at DESC', reason: 'Sorting by date' },

        // Reference lookups
        { name: 'IDX_cbt_loan_id', column: 'loan_id', reason: 'Finding transactions by loan' },
        { name: 'IDX_cbt_installment_id', column: 'installment_id', reason: 'Finding transactions by installment' },

        // Composite for common report pattern
        { name: 'IDX_cbt_cashbox_date', columns: ['cash_box_id', 'created_at DESC'], reason: 'Reports: transactions by box and date' },
        { name: 'IDX_cbt_cashbox_type', columns: ['cash_box_id', 'transaction_type'], reason: 'Reports: aggregation by type' },
    ],

    // =====================
    // CASH_BOXES TABLE (MEDIUM PRIORITY)
    // =====================
    cash_boxes: [
        { name: 'IDX_cashboxes_institution_id', column: 'institution_id', reason: 'Filtering by institution' },
        { name: 'IDX_cashboxes_branch_id', column: 'branch_id', reason: 'Filtering by branch' },
        { name: 'IDX_cashboxes_box_type', column: 'box_type', reason: 'Filtering by box type' },
    ],

    // =====================
    // CUSTOMER_RELATIONS TABLE (HIGH PRIORITY)
    // Soft delete and linking
    // =====================
    customer_relations: [
        // Composite for most common lookup
        { name: 'IDX_cr_customer_institution', columns: ['customer_id', 'institution_id'], reason: 'Linking lookup' },

        // Soft delete filtering
        { name: 'IDX_cr_deleted_at', column: 'deleted_at', reason: 'Filtering active/deleted relations' },

        // Branch filtering
        { name: 'IDX_cr_branch_id', column: 'branch_id', reason: 'Filtering by branch' },

        // Full composite for exact lookup
        { name: 'IDX_cr_customer_institution_branch', columns: ['customer_id', 'institution_id', 'branch_id'], reason: 'Exact relation lookup' },
    ],

    // =====================
    // BRANCHES TABLE (MEDIUM PRIORITY)
    // =====================
    branches: [
        { name: 'IDX_branches_institution_id', column: 'institution_id', reason: 'Filtering by institution' },
        { name: 'IDX_branches_is_active', column: 'is_active', reason: 'Filtering active branches' },
    ],

    // =====================
    // USERS TABLE (MEDIUM PRIORITY)
    // =====================
    users: [
        { name: 'IDX_users_institution_id', column: 'institution_id', reason: 'Filtering by institution' },
        { name: 'IDX_users_branch_id', column: 'branch_id', reason: 'Filtering by branch' },
        { name: 'IDX_users_role_id', column: 'role_id', reason: 'JOIN with roles' },
        { name: 'IDX_users_is_active', column: 'is_active', reason: 'Filtering active users' },
        { name: 'IDX_users_email', column: 'email', reason: 'Login lookup' },
    ],

    // =====================
    // SUBSCRIPTION_REQUESTS TABLE (MEDIUM PRIORITY)
    // =====================
    subscription_requests: [
        { name: 'IDX_subreq_status', column: 'status', reason: 'Filtering by status (Pending/Approved/etc)' },
        { name: 'IDX_subreq_institution_id', column: 'institution_id', reason: 'Filtering by institution' },
        { name: 'IDX_subreq_branch_id', column: 'branch_id', reason: 'Filtering by branch' },
        { name: 'IDX_subreq_requester_type', column: 'requester_type', reason: 'Filtering by type' },
    ],

    // =====================
    // PRODUCTS TABLE (LOW PRIORITY)
    // =====================
    products: [
        { name: 'IDX_products_institution_id', column: 'institution_id', reason: 'Filtering by institution' },
        { name: 'IDX_products_is_active', column: 'is_active', reason: 'Filtering active products' },
    ],

    // =====================
    // SEARCH_LOGS TABLE (LOW PRIORITY)
    // =====================
    search_logs: [
        { name: 'IDX_searchlogs_customer_id', column: 'customer_id', reason: 'Tracking by customer' },
        { name: 'IDX_searchlogs_user_id', column: 'user_id', reason: 'Tracking by user' },
        { name: 'IDX_searchlogs_created_at', column: 'created_at DESC', reason: 'Sorting by date' },
    ],
};

// ===============================================
// EXECUTION LOGIC
// ===============================================

async function applyIndexes() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'q1key',
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

    const results = {
        created: [],
        existed: [],
        failed: [],
    };

    try {
        console.log('🚀 Connecting to database...');
        await client.connect();
        console.log('✅ Connected successfully\n');

        console.log('='.repeat(60));
        console.log('📊 APPLYING PERFORMANCE INDEXES');
        console.log('='.repeat(60));

        for (const [tableName, indexes] of Object.entries(INDEXES)) {
            console.log(`\n📁 Table: ${tableName}`);
            console.log('-'.repeat(40));

            for (const idx of indexes) {
                let indexQuery;

                if (idx.columns) {
                    // Composite index
                    const columnList = idx.columns.map(c => `"${c.replace(' DESC', '')}"${c.includes(' DESC') ? ' DESC' : ''}`).join(', ');
                    indexQuery = `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${idx.name}" ON "${tableName}" (${columnList})`;
                } else {
                    // Single column index
                    const columnName = idx.column.replace(' DESC', '');
                    const direction = idx.column.includes(' DESC') ? ' DESC' : '';
                    indexQuery = `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${idx.name}" ON "${tableName}" ("${columnName}"${direction})`;
                }

                try {
                    await client.query(indexQuery);
                    console.log(`  ✅ ${idx.name}`);
                    console.log(`     └─ ${idx.reason}`);
                    results.created.push(idx.name);
                } catch (error) {
                    if (error.message.includes('already exists')) {
                        console.log(`  ⏭️ ${idx.name} (already exists)`);
                        results.existed.push(idx.name);
                    } else if (error.message.includes('does not exist')) {
                        console.log(`  ⚠️ ${idx.name} - Table or column does not exist`);
                        results.failed.push({ name: idx.name, error: 'Table/column not found' });
                    } else {
                        console.log(`  ❌ ${idx.name}: ${error.message}`);
                        results.failed.push({ name: idx.name, error: error.message });
                    }
                }
            }
        }

        // ===============================================
        // SUMMARY
        // ===============================================
        console.log('\n' + '='.repeat(60));
        console.log('📋 SUMMARY');
        console.log('='.repeat(60));
        console.log(`  ✅ Created:  ${results.created.length}`);
        console.log(`  ⏭️ Existed:  ${results.existed.length}`);
        console.log(`  ❌ Failed:   ${results.failed.length}`);
        console.log('='.repeat(60));

        if (results.failed.length > 0) {
            console.log('\n⚠️ Failed indexes:');
            results.failed.forEach(f => console.log(`   - ${f.name}: ${f.error}`));
        }

        // ===============================================
        // ANALYZE TABLES
        // ===============================================
        console.log('\n🔄 Running ANALYZE on tables to update statistics...');

        const tables = Object.keys(INDEXES);
        for (const table of tables) {
            try {
                await client.query(`ANALYZE "${table}"`);
                console.log(`  ✅ ANALYZE ${table}`);
            } catch (e) {
                console.log(`  ⚠️ ANALYZE ${table} - skipped`);
            }
        }

        console.log('\n🎉 Index application completed!');
        console.log('   Note: Indexes improve query performance but may slightly slow down INSERTs/UPDATEs.');
        console.log('   This is a normal trade-off for read-heavy applications.\n');

    } catch (error) {
        console.error('\n❌ Critical error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('📊 Database connection closed.');
    }
}

// Run the script
applyIndexes();

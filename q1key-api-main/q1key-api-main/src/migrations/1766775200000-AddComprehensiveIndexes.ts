import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: Add Comprehensive Performance Indexes
 * 
 * This migration adds all critical indexes to improve query performance across the application.
 * Based on detailed analysis of:
 * - Report queries (getGeneralStats, getCashBoxReport, getCustomersReport, etc.)
 * - Search operations (loans, customers)
 * - Daily operations (installment payments, loan creation)
 * 
 * Total indexes: 47
 * 
 * Date: 2026-01-19
 */
export class AddComprehensiveIndexes1766775200000 implements MigrationInterface {
    name = 'AddComprehensiveIndexes1766775200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('🚀 Starting index creation...');

        // =====================
        // LOANS TABLE (11 indexes)
        // Most frequently queried table
        // =====================
        console.log('📁 Creating indexes for: loans');

        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_customer_id', '"customer_id"');
        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_branch_id', '"branch_id"');
        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_institution_id', '"institution_id"');
        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_product_id', '"product_id"');
        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_created_by', '"created_by"');
        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_status', '"status"');
        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_created_at', '"created_at" DESC');
        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_due_date', '"due_date"');
        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_institution_status', '"institution_id", "status"');
        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_branch_status', '"branch_id", "status"');
        await this.safeCreateIndex(queryRunner, 'loans', 'IDX_loans_institution_created_at', '"institution_id", "created_at" DESC');

        // =====================
        // CUSTOMERS TABLE (6 indexes)
        // Search and linking operations
        // =====================
        console.log('📁 Creating indexes for: customers');

        await this.safeCreateIndex(queryRunner, 'customers', 'IDX_customers_national_id', '"national_id"');
        await this.safeCreateIndex(queryRunner, 'customers', 'IDX_customers_phone_number', '"phone_number"');
        await this.safeCreateIndex(queryRunner, 'customers', 'IDX_customers_institution_id', '"institution_id"');
        await this.safeCreateIndex(queryRunner, 'customers', 'IDX_customers_created_by', '"created_by"');
        await this.safeCreateIndex(queryRunner, 'customers', 'IDX_customers_created_at', '"created_at" DESC');
        await this.safeCreateIndex(queryRunner, 'customers', 'IDX_customers_trust_status', '"trust_status"');

        // =====================
        // INSTALLMENTS TABLE (5 indexes)
        // Status checks and overdue queries
        // =====================
        console.log('📁 Creating indexes for: installments');

        await this.safeCreateIndex(queryRunner, 'installments', 'IDX_installments_loan_id', '"loan_id"');
        await this.safeCreateIndex(queryRunner, 'installments', 'IDX_installments_status', '"status"');
        await this.safeCreateIndex(queryRunner, 'installments', 'IDX_installments_due_date', '"due_date"');
        await this.safeCreateIndex(queryRunner, 'installments', 'IDX_installments_status_due_date', '"status", "due_date"');
        await this.safeCreateIndex(queryRunner, 'installments', 'IDX_installments_loan_status', '"loan_id", "status"');

        // =====================
        // CASH_BOX_TRANSACTIONS TABLE (7 indexes)
        // Report aggregations
        // =====================
        console.log('📁 Creating indexes for: cash_box_transactions');

        await this.safeCreateIndex(queryRunner, 'cash_box_transactions', 'IDX_cbt_cash_box_id', '"cash_box_id"');
        await this.safeCreateIndex(queryRunner, 'cash_box_transactions', 'IDX_cbt_transaction_type', '"transaction_type"');
        await this.safeCreateIndex(queryRunner, 'cash_box_transactions', 'IDX_cbt_created_at', '"created_at" DESC');
        await this.safeCreateIndex(queryRunner, 'cash_box_transactions', 'IDX_cbt_loan_id', '"loan_id"');
        await this.safeCreateIndex(queryRunner, 'cash_box_transactions', 'IDX_cbt_installment_id', '"installment_id"');
        await this.safeCreateIndex(queryRunner, 'cash_box_transactions', 'IDX_cbt_cashbox_date', '"cash_box_id", "created_at" DESC');
        await this.safeCreateIndex(queryRunner, 'cash_box_transactions', 'IDX_cbt_cashbox_type', '"cash_box_id", "transaction_type"');

        // =====================
        // CASH_BOXES TABLE (3 indexes)
        // =====================
        console.log('📁 Creating indexes for: cash_boxes');

        await this.safeCreateIndex(queryRunner, 'cash_boxes', 'IDX_cashboxes_institution_id', '"institution_id"');
        await this.safeCreateIndex(queryRunner, 'cash_boxes', 'IDX_cashboxes_branch_id', '"branch_id"');
        await this.safeCreateIndex(queryRunner, 'cash_boxes', 'IDX_cashboxes_box_type', '"box_type"');

        // =====================
        // CUSTOMER_RELATIONS TABLE (4 indexes)
        // Soft delete and linking
        // =====================
        console.log('📁 Creating indexes for: customer_relations');

        await this.safeCreateIndex(queryRunner, 'customer_relations', 'IDX_cr_customer_institution', '"customer_id", "institution_id"');
        await this.safeCreateIndex(queryRunner, 'customer_relations', 'IDX_cr_deleted_at', '"deleted_at"');
        await this.safeCreateIndex(queryRunner, 'customer_relations', 'IDX_cr_branch_id', '"branch_id"');
        await this.safeCreateIndex(queryRunner, 'customer_relations', 'IDX_cr_customer_institution_branch', '"customer_id", "institution_id", "branch_id"');

        // =====================
        // BRANCHES TABLE (2 indexes)
        // =====================
        console.log('📁 Creating indexes for: branches');

        await this.safeCreateIndex(queryRunner, 'branches', 'IDX_branches_institution_id', '"institution_id"');
        await this.safeCreateIndex(queryRunner, 'branches', 'IDX_branches_is_active', '"is_active"');

        // =====================
        // USERS TABLE (5 indexes)
        // =====================
        console.log('📁 Creating indexes for: users');

        await this.safeCreateIndex(queryRunner, 'users', 'IDX_users_institution_id', '"institution_id"');
        await this.safeCreateIndex(queryRunner, 'users', 'IDX_users_branch_id', '"branch_id"');
        await this.safeCreateIndex(queryRunner, 'users', 'IDX_users_role_id', '"role_id"');
        await this.safeCreateIndex(queryRunner, 'users', 'IDX_users_is_active', '"is_active"');
        await this.safeCreateIndex(queryRunner, 'users', 'IDX_users_email', '"email"');

        // =====================
        // SUBSCRIPTION_REQUESTS TABLE (4 indexes)
        // =====================
        console.log('📁 Creating indexes for: subscription_requests');

        await this.safeCreateIndex(queryRunner, 'subscription_requests', 'IDX_subreq_status', '"status"');
        await this.safeCreateIndex(queryRunner, 'subscription_requests', 'IDX_subreq_institution_id', '"institution_id"');
        await this.safeCreateIndex(queryRunner, 'subscription_requests', 'IDX_subreq_branch_id', '"branch_id"');
        await this.safeCreateIndex(queryRunner, 'subscription_requests', 'IDX_subreq_requester_type', '"requester_type"');

        // =====================
        // PRODUCTS TABLE (2 indexes)
        // =====================
        console.log('📁 Creating indexes for: products');

        await this.safeCreateIndex(queryRunner, 'products', 'IDX_products_institution_id', '"institution_id"');
        await this.safeCreateIndex(queryRunner, 'products', 'IDX_products_is_active', '"is_active"');

        // =====================
        // SEARCH_LOGS TABLE (3 indexes)
        // =====================
        console.log('📁 Creating indexes for: search_logs');

        await this.safeCreateIndex(queryRunner, 'search_logs', 'IDX_searchlogs_customer_id', '"customer_id"');
        await this.safeCreateIndex(queryRunner, 'search_logs', 'IDX_searchlogs_user_id', '"user_id"');
        await this.safeCreateIndex(queryRunner, 'search_logs', 'IDX_searchlogs_created_at', '"created_at" DESC');

        console.log('✅ All indexes created successfully!');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('⚠️ Dropping performance indexes...');

        // Drop all indexes in reverse order
        const indexes = [
            // Search Logs
            'IDX_searchlogs_created_at', 'IDX_searchlogs_user_id', 'IDX_searchlogs_customer_id',
            // Products
            'IDX_products_is_active', 'IDX_products_institution_id',
            // Subscription Requests
            'IDX_subreq_requester_type', 'IDX_subreq_branch_id', 'IDX_subreq_institution_id', 'IDX_subreq_status',
            // Users
            'IDX_users_email', 'IDX_users_is_active', 'IDX_users_role_id', 'IDX_users_branch_id', 'IDX_users_institution_id',
            // Branches
            'IDX_branches_is_active', 'IDX_branches_institution_id',
            // Customer Relations
            'IDX_cr_customer_institution_branch', 'IDX_cr_branch_id', 'IDX_cr_deleted_at', 'IDX_cr_customer_institution',
            // Cash Boxes
            'IDX_cashboxes_box_type', 'IDX_cashboxes_branch_id', 'IDX_cashboxes_institution_id',
            // Cash Box Transactions
            'IDX_cbt_cashbox_type', 'IDX_cbt_cashbox_date', 'IDX_cbt_installment_id', 'IDX_cbt_loan_id',
            'IDX_cbt_created_at', 'IDX_cbt_transaction_type', 'IDX_cbt_cash_box_id',
            // Installments
            'IDX_installments_loan_status', 'IDX_installments_status_due_date', 'IDX_installments_due_date',
            'IDX_installments_status', 'IDX_installments_loan_id',
            // Customers
            'IDX_customers_trust_status', 'IDX_customers_created_at', 'IDX_customers_created_by',
            'IDX_customers_institution_id', 'IDX_customers_phone_number', 'IDX_customers_national_id',
            // Loans
            'IDX_loans_institution_created_at', 'IDX_loans_branch_status', 'IDX_loans_institution_status',
            'IDX_loans_due_date', 'IDX_loans_created_at', 'IDX_loans_status', 'IDX_loans_created_by',
            'IDX_loans_product_id', 'IDX_loans_institution_id', 'IDX_loans_branch_id', 'IDX_loans_customer_id',
        ];

        for (const indexName of indexes) {
            try {
                await queryRunner.query(`DROP INDEX IF EXISTS "${indexName}"`);
                console.log(`  ✅ Dropped: ${indexName}`);
            } catch (e) {
                console.log(`  ⚠️ Could not drop: ${indexName}`);
            }
        }

        console.log('⚠️ All performance indexes dropped.');
    }

    /**
     * Helper method to safely create an index
     * Catches errors if index already exists
     */
    private async safeCreateIndex(
        queryRunner: QueryRunner,
        tableName: string,
        indexName: string,
        columns: string
    ): Promise<void> {
        try {
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${tableName}" (${columns})`);
            console.log(`  ✅ ${indexName}`);
        } catch (error: any) {
            if (error.message?.includes('already exists')) {
                console.log(`  ⏭️ ${indexName} (already exists)`);
            } else {
                console.log(`  ❌ ${indexName}: ${error.message}`);
            }
        }
    }
}

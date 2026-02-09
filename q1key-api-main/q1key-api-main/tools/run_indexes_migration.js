/**
 * Script to run the performance indexes migration
 * 
 * Usage: node run_indexes_migration.js
 * 
 * This script will:
 * 1. Connect to the database
 * 2. Create performance indexes for better query performance
 * 3. Report success/failure
 */

const { Client } = require('pg');
require('dotenv').config();

const indexQueries = [
    // LOANS TABLE INDEXES
    `CREATE INDEX IF NOT EXISTS "IDX_loans_institution_id" ON "loans" ("institution_id")`,
    `CREATE INDEX IF NOT EXISTS "IDX_loans_branch_id" ON "loans" ("branch_id")`,
    `CREATE INDEX IF NOT EXISTS "IDX_loans_customer_id" ON "loans" ("customer_id")`,
    `CREATE INDEX IF NOT EXISTS "IDX_loans_status" ON "loans" ("status")`,
    `CREATE INDEX IF NOT EXISTS "IDX_loans_created_at" ON "loans" ("created_at" DESC)`,
    `CREATE INDEX IF NOT EXISTS "IDX_loans_institution_status" ON "loans" ("institution_id", "status")`,
    `CREATE INDEX IF NOT EXISTS "IDX_loans_branch_status" ON "loans" ("branch_id", "status")`,

    // CUSTOMERS TABLE INDEXES
    `CREATE INDEX IF NOT EXISTS "IDX_customers_national_id" ON "customers" ("national_id")`,
    `CREATE INDEX IF NOT EXISTS "IDX_customers_phone_number" ON "customers" ("phone_number")`,
    `CREATE INDEX IF NOT EXISTS "IDX_customers_institution_id" ON "customers" ("institution_id")`,
    `CREATE INDEX IF NOT EXISTS "IDX_customers_created_at" ON "customers" ("created_at" DESC)`,

    // CUSTOMER_RELATIONS TABLE INDEXES
    `CREATE INDEX IF NOT EXISTS "IDX_customer_relations_customer_institution" ON "customer_relations" ("customer_id", "institution_id")`,
    `CREATE INDEX IF NOT EXISTS "IDX_customer_relations_deleted_at" ON "customer_relations" ("deleted_at")`,

    // CASH_BOX_TRANSACTIONS TABLE INDEXES
    `CREATE INDEX IF NOT EXISTS "IDX_cash_box_transactions_cash_box_id" ON "cash_box_transactions" ("cash_box_id")`,
    `CREATE INDEX IF NOT EXISTS "IDX_cash_box_transactions_created_at" ON "cash_box_transactions" ("created_at" DESC)`,
    `CREATE INDEX IF NOT EXISTS "IDX_cash_box_transactions_type" ON "cash_box_transactions" ("transaction_type")`,
    `CREATE INDEX IF NOT EXISTS "IDX_cash_box_transactions_cashbox_date" ON "cash_box_transactions" ("cash_box_id", "created_at" DESC)`,

    // CASH_BOXES TABLE INDEXES
    `CREATE INDEX IF NOT EXISTS "IDX_cash_boxes_institution_id" ON "cash_boxes" ("institution_id")`,
    `CREATE INDEX IF NOT EXISTS "IDX_cash_boxes_branch_id" ON "cash_boxes" ("branch_id")`,

    // INSTALLMENTS TABLE INDEXES
    `CREATE INDEX IF NOT EXISTS "IDX_installments_loan_id" ON "installments" ("loan_id")`,
    `CREATE INDEX IF NOT EXISTS "IDX_installments_status" ON "installments" ("status")`,
    `CREATE INDEX IF NOT EXISTS "IDX_installments_due_date" ON "installments" ("due_date")`,
    `CREATE INDEX IF NOT EXISTS "IDX_installments_status_due_date" ON "installments" ("status", "due_date")`,

    // BRANCHES TABLE INDEXES
    `CREATE INDEX IF NOT EXISTS "IDX_branches_institution_id" ON "branches" ("institution_id")`,

    // USERS TABLE INDEXES
    `CREATE INDEX IF NOT EXISTS "IDX_users_institution_id" ON "users" ("institution_id")`,
    `CREATE INDEX IF NOT EXISTS "IDX_users_branch_id" ON "users" ("branch_id")`,

    // SUBSCRIPTION_REQUESTS TABLE INDEXES
    `CREATE INDEX IF NOT EXISTS "IDX_subscription_requests_status" ON "subscription_requests" ("status")`,
];

async function runMigration() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'q1key',
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

    try {
        console.log('📊 Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database\n');

        console.log('🔧 Creating performance indexes...\n');

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const query of indexQueries) {
            const indexName = query.match(/"IDX_[^"]+"/)?.[0] || 'Unknown';
            try {
                await client.query(query);
                console.log(`  ✅ ${indexName}`);
                successCount++;
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`  ⏭️ ${indexName} (already exists)`);
                    skipCount++;
                } else {
                    console.log(`  ❌ ${indexName}: ${error.message}`);
                    errorCount++;
                }
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('📋 SUMMARY:');
        console.log(`   ✅ Created: ${successCount}`);
        console.log(`   ⏭️ Skipped: ${skipCount}`);
        console.log(`   ❌ Errors:  ${errorCount}`);
        console.log('='.repeat(50));

        if (errorCount === 0) {
            console.log('\n🎉 Migration completed successfully!');
        } else {
            console.log('\n⚠️ Migration completed with some errors.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n📊 Database connection closed.');
    }
}

runMigration();

const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'hares_db',
    password: process.env.DB_PASSWORD || '303101',
    port: 5432,
});

async function applyIndexes() {
    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL database: hares_db');

        const indexes = [
            // LOANS
            "CREATE INDEX IF NOT EXISTS \"IDX_LOAN_CUSTOMER\" ON loans(customer_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_LOAN_BRANCH\" ON loans(branch_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_LOAN_INSTITUTION\" ON loans(institution_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_LOAN_PRODUCT\" ON loans(product_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_LOAN_CREATOR\" ON loans(created_by);",
            "CREATE INDEX IF NOT EXISTS \"IDX_LOAN_STATUS\" ON loans(status);",

            // CUSTOMERS
            "CREATE INDEX IF NOT EXISTS \"IDX_CUSTOMER_INSTITUTION\" ON customers(institution_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_CUSTOMER_CREATOR\" ON customers(created_by);",
            "CREATE INDEX IF NOT EXISTS \"IDX_CUSTOMER_NATIONAL_ID\" ON customers(national_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_CUSTOMER_PHONE\" ON customers(phone_number);",

            // TRANSACTIONS
            "CREATE INDEX IF NOT EXISTS \"IDX_TXN_CASHBOX\" ON cash_box_transactions(cash_box_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_TXN_TYPE\" ON cash_box_transactions(transaction_type);",
            "CREATE INDEX IF NOT EXISTS \"IDX_TXN_LOAN\" ON cash_box_transactions(loan_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_TXN_CREATOR\" ON cash_box_transactions(created_by);",

            // INSTALLMENTS
            "CREATE INDEX IF NOT EXISTS \"IDX_INSTALLMENT_LOAN\" ON installments(loan_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_INSTALLMENT_DUE_DATE\" ON installments(due_date);",
            "CREATE INDEX IF NOT EXISTS \"IDX_INSTALLMENT_STATUS\" ON installments(status);",

            // SUBSCRIPTION REQUESTS
            "CREATE INDEX IF NOT EXISTS \"IDX_SUB_REQ_TYPE\" ON subscription_requests(requester_type);",
            "CREATE INDEX IF NOT EXISTS \"IDX_SUB_REQ_INSTITUTION\" ON subscription_requests(institution_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_SUB_REQ_BRANCH\" ON subscription_requests(branch_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_SUB_REQ_PLAN\" ON subscription_requests(plan_id);",
            "CREATE INDEX IF NOT EXISTS \"IDX_SUB_REQ_STATUS\" ON subscription_requests(status);"
        ];

        console.log('\nApplying indexes...');
        for (const sql of indexes) {
            try {
                await client.query(sql);
                const indexName = sql.split('"')[1];
                console.log(`✅ Applied index: ${indexName}`);
            } catch (err) {
                console.error(`❌ Failed: ${sql.split('ON')[0]} - Error: ${err.message}`);
            }
        }

        console.log('\n✨ Database optimization completed successfully!');

    } catch (err) {
        console.error('❌ Connection Error:', err.message);
    } finally {
        await client.end();
    }
}

applyIndexes();

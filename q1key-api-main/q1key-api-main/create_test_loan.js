const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function createTestLoan() {
    try {
        await client.connect();

        // Get a product ID
        let res = await client.query('SELECT product_id FROM products LIMIT 1');
        const productId = res.rows[0]?.product_id || 1;
        console.log('Using product ID:', productId);

        // Create loan for customer 3 (سلطان الغامدي) in branch 2 (فرع جدة)
        // This way, khaled (who is in branch 2) will be blocked from soft-deleting
        const customerId = 3;
        const branchId = 2; // فرع جدة
        const institutionId = 1;

        console.log('Creating loan for customer', customerId, 'in branch', branchId);

        res = await client.query(`
            INSERT INTO loans (customer_id, branch_id, institution_id, product_id, 
                              principal_amount, profit_amount, paid_amount, status, 
                              payment_plan_months, due_date, created_by)
            VALUES ($1, $2, $3, $4, 5000, 500, 0, 'Active', 6, NOW() + INTERVAL '6 months', 4)
            RETURNING *
        `, [customerId, branchId, institutionId, productId]);

        console.log('Created loan:');
        console.table(res.rows);

        // Verify loans in branch 2
        console.log('\n=== ALL LOANS IN BRANCH 2 (JEDDAH) ===');
        res = await client.query(`
            SELECT l.loan_id, l.customer_id, c.name, c.national_id, l.branch_id, l.principal_amount, l.status
            FROM loans l 
            JOIN customers c ON l.customer_id = c.customer_id 
            WHERE l.branch_id = 2
        `);
        console.table(res.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

createTestLoan();

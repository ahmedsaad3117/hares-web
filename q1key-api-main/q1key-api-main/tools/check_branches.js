const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function checkBranchData() {
    try {
        await client.connect();

        console.log('=== BRANCHES ===');
        let res = await client.query('SELECT branch_id, name, institution_id FROM branches');
        console.table(res.rows);

        console.log('\n=== LOANS WITH BRANCHES ===');
        res = await client.query(`
            SELECT l.loan_id, l.customer_id, c.name as customer_name, 
                   l.branch_id, b.name as branch_name, l.institution_id 
            FROM loans l 
            JOIN customers c ON l.customer_id = c.customer_id 
            LEFT JOIN branches b ON l.branch_id = b.branch_id
        `);
        console.table(res.rows);

        console.log('\n=== BRANCH USERS ===');
        res = await client.query(`
            SELECT u.user_id, u.name, u.email, u.branch_id, b.name as branch_name, u.institution_id 
            FROM users u 
            LEFT JOIN branches b ON u.branch_id = b.branch_id 
            WHERE u.branch_id IS NOT NULL
        `);
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkBranchData();

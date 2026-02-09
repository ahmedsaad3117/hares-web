const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function debugMofrad() {
    try {
        await client.connect();

        // 1. Get Mofrad User Info
        const userRes = await client.query("SELECT user_id, name, email, institution_id, role_id FROM users WHERE email LIKE '%mofrad%' OR name LIKE '%Mofrad%'");
        console.log('--- User Info ---');
        console.table(userRes.rows);

        if (userRes.rows.length === 0) {
            console.log('No Mofrad user found.');
            return;
        }

        const mofradUser = userRes.rows[0];

        // 2. Get Customer Info
        const custRes = await client.query("SELECT customer_id, name, national_id FROM customers WHERE national_id = '5555555555'");
        console.log('--- Customer Info ---');
        console.table(custRes.rows);

        if (custRes.rows.length === 0) {
            console.log('Customer not found.');
            return;
        }
        const customer = custRes.rows[0];

        // 3. Check specific relation
        const relRes = await client.query(`
        SELECT * FROM customer_relations 
        WHERE customer_id = $1 AND institution_id = $2
    `, [customer.customer_id, mofradUser.institution_id]);

        console.log('--- Existing Relation ---');
        if (relRes.rows.length > 0) {
            console.table(relRes.rows);
        } else {
            console.log('No relation found between Mofrad Corp and this customer.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

debugMofrad();

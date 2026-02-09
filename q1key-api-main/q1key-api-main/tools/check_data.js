const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function checkData() {
    try {
        await client.connect();

        console.log('=== INSTITUTIONS ===');
        let res = await client.query('SELECT institution_id, name FROM institutions');
        console.table(res.rows);

        console.log('\n=== USERS ===');
        res = await client.query('SELECT user_id, name, email, institution_id FROM users');
        console.table(res.rows);

        console.log('\n=== CUSTOMERS ===');
        res = await client.query('SELECT customer_id, name, national_id, institution_id as owner_inst FROM customers');
        console.table(res.rows);

        console.log('\n=== CUSTOMER RELATIONS ===');
        res = await client.query('SELECT cr.id, cr.customer_id, cr.institution_id, c.name as customer_name FROM customer_relations cr JOIN customers c ON cr.customer_id = c.customer_id WHERE cr.deleted_at IS NULL');
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkData();

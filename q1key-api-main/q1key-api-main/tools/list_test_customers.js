const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function listCustomers() {
    try {
        await client.connect();
        console.log('Fetching customers...');

        const res = await client.query(`
      SELECT 
        c.name, 
        c.national_id, 
        string_agg(DISTINCT i.name, ', ') as institutions
      FROM customers c
      JOIN customer_relations cr ON c.customer_id = cr.customer_id
      JOIN institutions i ON cr.institution_id = i.institution_id
      GROUP BY c.customer_id, c.name, c.national_id
      ORDER BY c.customer_id
    `);

        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

listCustomers();

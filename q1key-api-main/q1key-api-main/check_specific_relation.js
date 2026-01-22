const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function checkRelations() {
    try {
        await client.connect();
        const res = await client.query(`
      SELECT 
        c.name, 
        c.national_id, 
        cr.institution_id, 
        cr.branch_id, 
        i.name as inst_name, 
        b.name as branch_name, 
        cr.deleted_at 
      FROM customers c 
      JOIN customer_relations cr ON c.customer_id = cr.customer_id 
      JOIN institutions i ON cr.institution_id = i.institution_id 
      LEFT JOIN branches b ON cr.branch_id = b.branch_id 
      WHERE c.national_id = '5555555555'
    `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkRelations();

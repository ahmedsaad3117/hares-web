const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function listUsers() {
    try {
        await client.connect();
        const res = await client.query(`
      SELECT u.user_id, u.email, r.role_name, i.name as institution_name 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN institutions i ON u.institution_id = i.institution_id
      LIMIT 10
    `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

listUsers();

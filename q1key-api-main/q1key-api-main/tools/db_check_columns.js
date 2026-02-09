
const { Client } = require('pg');
require('dotenv').config({ path: 'c:/Users/MARWAN/Desktop/q1key/q1key-api-main/q1key-api-main/.env' });

async function checkColumns() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
    });

    try {
        await client.connect();
        console.log('Connected to DB');
        const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
        console.log('Columns in users table:', res.rows.map(r => r.column_name));
        await client.end();
    } catch (err) {
        console.error('DB Error:', err);
    }
}

checkColumns();

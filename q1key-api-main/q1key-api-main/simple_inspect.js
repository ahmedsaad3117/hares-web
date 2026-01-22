const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function inspect() {
    await client.connect();
    const res = await client.query('SELECT user_id, email, password_hash, role_id FROM users');
    console.log(res.rows);
    await client.end();
}

inspect();

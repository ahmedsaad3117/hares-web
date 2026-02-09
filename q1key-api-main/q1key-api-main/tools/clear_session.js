
const { Client } = require('pg');
require('dotenv').config({ path: 'c:/Users/MARWAN/Desktop/q1key/q1key-api-main/q1key-api-main/.env' });

async function clearSession() {
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
        await client.query('UPDATE users SET active_session_id = NULL, last_activity_at = NULL');
        console.log('Session cleared for ALL users');
        await client.end();
    } catch (err) {
        console.error('DB Error:', err);
    }
}

clearSession();

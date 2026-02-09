
const { Client } = require('pg');
require('dotenv').config({ path: 'c:/Users/MARWAN/Desktop/q1key/q1key-api-main/q1key-api-main/.env' });

async function checkFullUser() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
    });

    try {
        await client.connect();
        const res = await client.query('SELECT * FROM users WHERE email = \'admin@q1key.com\'');
        console.log('Full User data:', res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('DB Error:', err);
    }
}

checkFullUser();

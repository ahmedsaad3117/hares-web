const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function checkCounts() {
    try {
        await client.connect();
        const tables = ['users', 'institutions', 'branches', 'customers', 'loans', 'installments', 'products'];

        console.log('--- Database Counts ---');
        for (const table of tables) {
            const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`${table}: ${res.rows[0].count}`);
        }
        console.log('-----------------------');
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

checkCounts();

const { Client } = require('pg');

async function checkSettings() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '303101',
        database: 'hares_db',
    });

    try {
        await client.connect();
        const res = await client.query('SELECT * FROM telegram_settings');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkSettings();

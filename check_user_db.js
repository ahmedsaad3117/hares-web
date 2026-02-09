
const { Client } = require('pg');

async function checkUser() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '303101',
        database: 'hares_db',
    });

    try {
        await client.connect();
        const res = await client.query("SELECT email, \"isActive\", \"activeSessionId\" FROM users WHERE email = 'test1@example.com'");
        console.log(JSON.stringify(res.rows[0], null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkUser();

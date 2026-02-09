const { Client } = require('pg');
const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '###', // سأستخدم كلمة المرور من ملف .env
    database: 'hares_db',
});

async function checkRequests() {
    try {
        await client.connect();
        console.log('Connected to PostgreSQL');

        const res = await client.query('SELECT count(*) FROM subscription_requests');
        console.log('Total Requests in DB:', res.rows[0].count);

        const resByStatus = await client.query('SELECT status, count(*) FROM subscription_requests GROUP BY status');
        console.log('Requests by Status:', resByStatus.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

checkRequests();

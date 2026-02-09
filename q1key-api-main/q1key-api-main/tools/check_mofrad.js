
const { Client } = require('pg');
require('dotenv').config({ path: 'c:/Users/MARWAN/Desktop/q1key/q1key-api-main/q1key-api-main/.env' });

async function checkMofrad() {
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

        // Check institution
        const instRes = await client.query("SELECT institution_id, name, expiration_date FROM institutions WHERE name ILIKE '%Mofrad%'");
        console.log('Institutions:', instRes.rows);

        if (instRes.rows.length > 0) {
            const instId = instRes.rows[0].institution_id;
            // Check branches
            const branchRes = await client.query("SELECT branch_id, name, expiration_date FROM branches WHERE institution_id = $1", [instId]);
            console.log('Branches:', branchRes.rows);

            // Check users
            const userRes = await client.query("SELECT user_id, email, institution_id, branch_id FROM users WHERE institution_id = $1", [instId]);
            console.log('Users:', userRes.rows);
        }

        await client.end();
    } catch (err) {
        console.error('DB Error:', err);
    }
}

checkMofrad();

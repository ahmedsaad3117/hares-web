
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

        const query = `
      SELECT u.user_id, u.email, u.role_id, r.role_name, u.institution_id, u.branch_id,
             i.expiration_date as inst_exp, b.expiration_date as branch_exp
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN institutions i ON u.institution_id = i.institution_id
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      WHERE u.email = 'mofrad@test.com'
    `;

        const res = await client.query(query);
        console.log('User Details:', res.rows[0]);

        await client.end();
    } catch (err) {
        console.error('DB Error:', err);
    }
}

checkMofrad();

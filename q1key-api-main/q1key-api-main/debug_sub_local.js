
const { Client } = require('pg');

async function debugSubscription() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '303101',
        database: 'hares_db',
    });

    try {
        await client.connect();
        const res = await client.query(`
      SELECT u.email, u.name, u.institution_id, u.branch_id, 
             i.name as inst_name, i.expiration_date as inst_exp,
             b.name as branch_name, b.expiration_date as branch_exp
      FROM users u
      LEFT JOIN institutions i ON u.institution_id = i.institution_id
      LEFT JOIN branches b ON u.branch_id = b.branch_id
      WHERE u.name LIKE '%عبد الكريم%' OR i.name LIKE '%مهلة وعد%'
    `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

debugSubscription();

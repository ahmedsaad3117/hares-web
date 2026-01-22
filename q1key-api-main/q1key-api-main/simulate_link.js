const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function simulateLink() {
    try {
        await client.connect();

        const customerId = 5;
        const institutionId = 3; // Mofrad
        const branchId = null;

        console.log(`Simulating Link: Customer ${customerId} -> Inst ${institutionId}`);

        // Insert Relation directly
        const res = await client.query(`
      INSERT INTO customer_relations (customer_id, institution_id, branch_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [customerId, institutionId, branchId]);

        console.log('✅ Link Successful (DB Level):');
        console.table(res.rows);

        // Rollback (delete it) so the user can try again in UI
        await client.query(`DELETE FROM customer_relations WHERE id = $1`, [res.rows[0].id]);
        console.log('🔄 Rolled back (Deleted created relation) to keep state clean for UI test.');

    } catch (err) {
        console.error('❌ Link Failed:', err.message);
    } finally {
        await client.end();
    }
}

simulateLink();

const { Client } = require('pg');

const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '303101', // HARDCODED for this script only based on user env
    database: 'hares_db',
});

async function checkAdminBox() {
    try {
        await client.connect();

        // Check Admin Cash Box Transactions
        // We join with cash_boxes to filter only 'Admin' boxes
        const query = `
            SELECT 
                t.id, 
                t.transaction_type, 
                t.amount, 
                t.description, 
                cb.box_type,
                t.created_at
            FROM cash_box_transactions t 
            JOIN cash_boxes cb ON t.cash_box_id = cb.cash_box_id 
            WHERE cb.box_type = 'Admin' 
            ORDER BY t.created_at DESC 
            LIMIT 10;
        `;

        const res = await client.query(query);

        console.log("------------------------------------------");
        console.log(`Found ${res.rowCount} transactions for Admin Cash Box`);
        console.log("------------------------------------------");

        if (res.rowCount === 0) {
            console.log("No transactions found.");
        } else {
            res.rows.forEach(row => {
                console.log(`[${row.created_at}] Type: ${row.transaction_type} | Amount: ${row.amount} | Desc: ${row.description}`);
            });
        }

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

checkAdminBox();

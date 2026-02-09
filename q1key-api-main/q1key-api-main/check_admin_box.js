const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('q1key.db');

const query = `
    SELECT 
        t.id, 
        t.transaction_type, 
        t.amount, 
        t.description, 
        cb.box_type 
    FROM cash_box_transactions t 
    JOIN cash_boxes cb ON t.cash_box_id = cb.cash_box_id 
    WHERE cb.box_type = 'Admin' 
    ORDER BY t.created_at DESC 
    LIMIT 10
`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error("Error executing query:", err.message);
        return;
    }
    console.log("Admin Cash Box Transactions (Last 10):");
    console.log(JSON.stringify(rows, null, 2));
});

db.close();

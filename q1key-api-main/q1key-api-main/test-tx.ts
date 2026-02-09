import { DataSource } from 'typeorm';

async function testSql() {
    const ds = new DataSource({
        type: 'postgres', host: 'localhost', port: 5432, username: 'postgres', password: '303101', database: 'hares_db', synchronize: false
    });

    try {
        await ds.initialize();
        console.log('DB Connected');

        // Insert a dummy transaction
        const res = await ds.query(`
      INSERT INTO cash_box_transactions 
      (cash_box_id, transaction_type, amount, balance_before, balance_after, description, created_by, created_at)
      VALUES (1, 'Deposit', 100, 5305, 5405, 'Test SQL Deposit', 1, NOW())
      RETURNING id
    `);
        console.log('Inserted ID:', res[0].id);

        // Update balance
        await ds.query("UPDATE cash_boxes SET balance = 5405 WHERE cash_box_id = 1");
        console.log('Balance Updated');

        await ds.destroy();
    } catch (err) {
        console.error('Error:', err.message);
    }
}
testSql();

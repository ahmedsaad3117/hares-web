import { DataSource } from 'typeorm';

async function resetCashBoxes() {
    const ds = new DataSource({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: '303101',
        database: 'hares_db',
        synchronize: false
    });

    try {
        await ds.initialize();
        console.log('✅ Connected to database');

        // 1. Delete all transactions
        console.log('⏳ Clearing all transactions...');
        await ds.query('DELETE FROM cash_box_transactions');

        // 2. Reset all cash box balances to 0
        console.log('⏳ Resetting all cash box balances to 0.00...');
        await ds.query('UPDATE cash_boxes SET balance = 0');

        // Check results
        const boxes = await ds.query('SELECT cash_box_id, box_type, balance FROM cash_boxes');
        console.log('📊 Current Cash Boxes Status:');
        console.table(boxes);

        console.log('✨ All cash boxes have been initialized successfully!');
        await ds.destroy();
    } catch (err) {
        console.error('❌ Error during initialization:', err.message);
    }
}

resetCashBoxes();

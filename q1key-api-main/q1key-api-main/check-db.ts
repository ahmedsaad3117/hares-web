import { DataSource } from 'typeorm';

async function checkDb() {
    const ds = new DataSource({
        type: 'postgres', host: 'localhost', port: 5432, username: 'postgres', password: '303101', database: 'hares_db', synchronize: false
    });

    try {
        await ds.initialize();
        const tables = ['users', 'institutions', 'branches', 'loans', 'installments', 'cash_box_transactions', 'subscription_requests'];
        for (const table of tables) {
            const result = await ds.query(`SELECT COUNT(*) FROM ${table}`);
            console.log(`${table}: ${result[0].count}`);
        }
        await ds.destroy();
    } catch (err) {
        console.error('Error:', err.message);
    }
}
checkDb();

import { DataSource } from 'typeorm';

async function run() {
    const ds = new DataSource({
        type: 'postgres', host: 'localhost', port: 5432, username: 'postgres', password: '303101', database: 'hares_db', synchronize: false
    });
    await ds.initialize();
    const stats = await ds.query("SELECT status, COUNT(*) FROM subscription_requests GROUP BY status");
    console.log(JSON.stringify(stats, null, 2));

    const approved = await ds.query("SELECT id, amount, status FROM subscription_requests WHERE status = 'Approved'");
    console.log('Approved Requests:', JSON.stringify(approved, null, 2));

    await ds.destroy();
}
run();

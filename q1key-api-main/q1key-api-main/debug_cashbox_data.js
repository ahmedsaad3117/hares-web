
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { DataSource } = require('typeorm');
const { UsersService } = require('./dist/modules/users/users.service');

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const dataSource = app.get(DataSource);
    const usersService = app.get(UsersService);

    try {
        const user = await usersService.findByEmail('khaled@alamana.com');
        if (!user) {
            console.log('User not found');
            return;
        }
        console.log(`User: ${user.email}, InstID: ${user.institutionId}`);

        // Get Cash Boxes
        const cashBoxes = await dataSource.query(
            `SELECT * FROM cash_boxes WHERE institution_id = $1`,
            [user.institutionId]
        );

        console.log('--- Cash Boxes ---');
        console.table(cashBoxes);

        // Get Transactions
        const boxIds = cashBoxes.map(b => b.cashBoxId || b.cash_box_id); // check casing
        console.log('Box IDs:', boxIds);

        if (boxIds.length > 0) {
            const transactions = await dataSource.query(
                `SELECT id, cash_box_id, transaction_type, amount, balance_after, created_at FROM cash_box_transactions WHERE cash_box_id = ANY($1) ORDER BY created_at DESC LIMIT 20`,
                [boxIds]
            );
            console.log('--- Recent Transactions (Top 20) ---');
            console.table(transactions);

            // Count ALL transactions
            const count = await dataSource.query(
                `SELECT count(*) as total FROM cash_box_transactions WHERE cash_box_id = ANY($1)`,
                [boxIds]
            );
            console.log('Total Transactions Count:', count[0].total);
        } else {
            console.log('No cash boxes found for this institution.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await app.close();
    }
}

bootstrap();

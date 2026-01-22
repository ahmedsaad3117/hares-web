
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { UsersService } = require('./dist/modules/users/users.service');
const { CashBoxService } = require('./dist/modules/cash-box/cash-box.service');

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);
    const cashBoxService = app.get(CashBoxService);

    console.log('Finding user khaled@alamana.com...');
    const user = await usersService.findByEmail('khaled@alamana.com');

    if (!user) {
        console.log('User not found!');
        await app.close();
        return;
    }

    console.log('User found:', {
        id: user.userId,
        name: user.name,
        email: user.email,
        role: user.role ? user.role.roleName : 'No Role',
        institutionId: user.institutionId,
        branchId: user.branchId
    });

    console.log('Fetching CashBox stats...');
    // Simulate what the controller does
    try {
        const stats = await cashBoxService.getStats(user);
        console.log('Stats:', stats);

        console.log('Fetching Transactions...');
        const transactions = await cashBoxService.getTransactions(user, { page: 1, limit: 20 });
        console.log('Transactions Count:', transactions.data.length);
        transactions.data.forEach(t => {
            console.log(`- Type: ${t.type}, Amount: ${t.amount}, Date: ${t.transactionDate}, Desc: ${t.description}`);
        });

    } catch (e) {
        console.error('Error fetching cashbox info:', e);
    }

    await app.close();
}

bootstrap();

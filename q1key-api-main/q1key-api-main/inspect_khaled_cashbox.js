
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { UsersService } = require('./dist/modules/users/users.service');
const { CashBoxService } = require('./dist/modules/cash-box/cash-box.service');

async function bootstrap() {
    // Create context with logger disabled to see clean output
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const usersService = app.get(UsersService);
    const cashBoxService = app.get(CashBoxService);

    const email = 'khaled@alamana.com';
    const user = await usersService.findByEmail(email);

    if (!user) {
        console.log(`User ${email} NOT FOUND.`);
        await app.close();
        return;
    }

    console.log('--- User Details ---');
    console.log(`ID: ${user.userId}`);
    console.log(`Name: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role ? user.role.roleName : 'N/A'}`);
    console.log(`InstitutionID: ${user.institutionId}`);
    console.log(`BranchID: ${user.branchId}`);

    console.log('\n--- CashBoxService.getCashBoxForUser ---');
    try {
        const cashBox = await cashBoxService.getCashBoxForUser(user);
        console.log('Returned CashBox:', cashBox);

        if (cashBox.boxType === 'Aggregated' && user.institutionId) {
            console.log('\n--- Aggregated Logic Check ---');
            const branches = await cashBoxService.getBranchCashBoxes(user.institutionId);
            console.log('Branch Cash Boxes:');
            branches.forEach(b => {
                console.log(`- ID: ${b.cashBoxId}, Branch: ${b.branchName}, Balance: ${b.balance}`);
            });

            console.log('\n--- Institution Transactions Check ---');
            // Mock filter
            const filter = { page: 1, limit: 10 };
            const transactions = await cashBoxService.getInstitutionTransactions(user.institutionId, filter);
            console.log(`Found ${transactions.total} transactions.`);
            transactions.data.forEach(t => {
                console.log(`- [${t.transactionType}] Amount: ${t.amount}, BalanceAfter: ${t.balanceAfter}, Date: ${t.createdAt}`);
            });
        } else {
            console.log('\n--- Single Box Transactions Check ---');
            const filter = { page: 1, limit: 10 };
            const transactions = await cashBoxService.getTransactions(cashBox.cashBoxId, filter);
            console.log(`Found ${transactions.total} transactions.`);
        }

    } catch (e) {
        console.error('Error getting cashbox:', e);
    }

    await app.close();
}

bootstrap();

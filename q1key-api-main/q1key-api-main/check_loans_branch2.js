
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { DataSource } = require('typeorm');

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const dataSource = app.get(DataSource);

    console.log('--- Checking Loans for Branch 2 ---');
    try {
        const loans = await dataSource.query(`
            SELECT * FROM loans WHERE branch_id = 2
        `);
        console.table(loans);

        // Sum loan amounts
        const total = loans.reduce((sum, loan) => sum + parseFloat(loan.amount), 0);
        console.log('Total Loan Amount:', total);

    } catch (e) {
        console.error(e);
    }

    await app.close();
}

bootstrap();

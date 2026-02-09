const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '303101',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function check() {
    try {
        await client.connect();

        // 1. Find the institution
        const inst = await client.query("SELECT institution_id, name FROM institutions WHERE name LIKE '%الازدهار%' LIMIT 1");
        console.log('--- Institution ---');
        console.log(inst.rows[0]);

        if (inst.rows[0]) {
            const instId = inst.rows[0].institution_id;

            // 2. Find the loan
            const loan = await client.query(`
                SELECT loan_id, principal_amount, profit_amount, institution_id, branch_id, created_at 
                FROM loans 
                WHERE (institution_id = $1 OR branch_id IN (SELECT branch_id FROM branches WHERE institution_id = $1))
                AND principal_amount = 5000
                ORDER BY created_at DESC 
                LIMIT 5
            `, [instId]);

            console.log('\n--- Latest 5k Loans ---');
            console.log(JSON.stringify(loan.rows, null, 2));

            if (loan.rows[0]) {
                const loanId = loan.rows[0].loan_id;

                // 3. Find segments
                const insts = await client.query("SELECT id, installment_number, amount, status FROM installments WHERE loan_id = $1", [loanId]);
                console.log('\n--- Installments for loan ' + loanId + ' ---');
                console.log(JSON.stringify(insts.rows, null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

check();

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

// --- Data Arrays ---
const instNames = [
    'الأمانة للتمويل', 'الثقة للإقراض', 'تمويل الرياض', 'اليسر للائتمان', 'الوطنية للتمويل الرقمي',
    'بوابة التمويل', 'شركة قمة الانجاز', 'مستقبل التمويل', 'الريادة للاستثمار', 'تمويلك المتطور',
    'شركة التوازن المالي', 'المسار للتمويل', 'الافق للإقراض', 'ركيزة الائتمان', 'الازدهار المالي',
    'تمويل جدة الموحد', 'مؤسسة نمو التمويلية', 'حلول القروض الذكية', 'شركة وثاق للتمويل', 'منصة إقراض'
];

const customerNames = [
    'عبدالرحمن السديري', 'فهد العتيبي', 'محمد القحطاني', 'خالد الدوسري', 'تركي الشمري',
    'نواف الحربي', 'سلطان المطيري', 'عبدالله الزهراني', 'سعد الشهري', 'ماجد الغامدي',
    'صالح العمري', 'ياسر القحطاني', 'إبراهيم العنزي', 'سليمان الرشيدي', 'سعود السبيعي',
    'راكان البقمي', 'بندر الشلوي', 'مشاري العجمي', 'فيصل بن خالد', 'وليد السعدون',
    'أحمد العيسى', 'باسم الراجحي', 'عادل التميمي', 'فواز السلمي', 'مازن الظفيري',
    'أسامة المالكي', 'منصور الهذلي', 'طلال بن علي', 'عمر باوزير', 'زياد الرشيد',
    'خليل إبراهيم', 'فارس العتيبي', 'ثامر السليمان', 'سطام الشريف', 'مساعد بن عجلان',
    'لؤي الأحمد', 'سراج الصالح', 'بدر العيسى', 'فادي المحمد', 'يحيى مروان',
    'جابر المطر', 'حسان الشيخ', 'نبراس الهدى', 'صهيب الشوكاني', 'أبرار عبدالله',
    'نورة السعيد', 'هيا المطيري', 'سارة الدوسري', 'ريم العبدالله', 'جواهر الفهد'
];

const cities = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر', 'بريدة', 'تبوك', 'أبها', 'نجران'];

// --- Helpers ---
const randomAmount = (min, max) => (Math.random() * (max - min) + min).toFixed(2);
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

async function bulkSeed() {
    try {
        console.log('🚀 Starting Bulk Seeding Process...');
        await client.connect();
        console.log('✅ Connected to database');

        // Resetting sequences and disabling triggers for speed
        await client.query('SET session_replication_role = replica;');

        // Clear all tables except roles
        const tables = ['search_logs', 'cash_box_transactions', 'cash_boxes', 'installments', 'loans', 'customer_relations', 'customer_notes', 'customers', 'products', 'users', 'branches', 'institutions', 'subscription_requests'];
        for (const table of tables) {
            await client.query(`DELETE FROM ${table}`);
        }
        console.log('🗑️  Database cleared');

        // 1. Ensure Roles
        await client.query("INSERT INTO roles (role_name) VALUES ('Super Admin'), ('Institution'), ('Branch') ON CONFLICT DO NOTHING;");
        const rolesRes = await client.query("SELECT role_id, role_name FROM roles");
        const roles = {};
        rolesRes.rows.forEach(r => roles[r.role_name] = r.role_id);
        console.log('✅ Roles prepared');

        const hashedPassword = await bcrypt.hash('123456', 10);

        // 2. Create Super Admin
        await client.query(`INSERT INTO users (role_id, name, email, password_hash, is_active) VALUES ($1, $2, $3, $4, $5)`,
            [roles['Super Admin'], 'مدير النظام الرئيسي', 'admin@q1key.com', hashedPassword, true]);
        console.log('✅ Super Admin created');

        // 3. Create Products
        const productsRes = await client.query(`
        INSERT INTO products (name, description, is_active) VALUES 
        ('قرض شخصي مرن', 'تمويل شخصي مخصص للافراد بأقساط ميسرة', TRUE),
        ('تمويل مشاريع صغيرة', 'دعم مالي للمشاريع الناشئة والاعمال الحرة', TRUE),
        ('تمويل عقاري سكني', 'قروض مخصصة لشراء او بناء الوحدات السكنية', TRUE),
        ('تمويل مركبات', 'شراء سيارات جديدة او مستعملة بنظام المرابحة', TRUE),
        ('قرض التعليم والزواج', 'تمويل مخصص للمناسبات والاحتياجات الاجتماعية', TRUE)
        RETURNING product_id
    `);
        const productIds = productsRes.rows.map(r => r.product_id);
        console.log('✅ 5 Products created');

        // 4. Create Institutions & Institution Users
        const instIds = [];
        for (let i = 0; i < 20; i++) {
            const name = instNames[i];
            const res = await client.query(`
            INSERT INTO institutions (name, tax_id, phone_number, email, max_users, can_create_branches, is_active)
            VALUES ($1, $2, $3, $4, 50, TRUE, TRUE) RETURNING institution_id
        `, [name, `100${1000 + i}`, `05${randomInt(10000000, 99999999)}`, `ceo@inst${i}.com`]);
            const instId = res.rows[0].institution_id;
            instIds.push(instId);

            // Inst User
            await client.query(`
            INSERT INTO users (role_id, institution_id, name, email, password_hash, is_active)
            VALUES ($1, $2, $3, $4, $5, TRUE)
        `, [roles['Institution'], instId, `مدير ${name}`, `admin@inst${i}.com`, hashedPassword]);

            // Setup initial admin cashbox for institution
            await client.query(`INSERT INTO cash_boxes (institution_id, box_type, balance, is_active) VALUES ($1, 'Institution', 0, TRUE)`, [instId]);
        }
        console.log('✅ 20 Institutions created with their Admins');

        // 5. Create 30 Branches
        const branchIds = [];
        const instForBranches = instIds.slice(0, 10).concat(instIds); // Spread multiple branches to some insts
        for (let i = 0; i < 30; i++) {
            const instId = instForBranches[i % instForBranches.length];
            const cityName = cities[i % cities.length];
            const branchName = `فرع ${cityName} - ${i + 1}`;
            const res = await client.query(`
            INSERT INTO branches (name, institution_id, phone_number)
            VALUES ($1, $2, $3) RETURNING branch_id
        `, [branchName, instId, `011${randomInt(1000000, 9999999)}`]);
            const bId = res.rows[0].branch_id;
            branchIds.push(bId);

            // Branch User (Manager)
            await client.query(`
            INSERT INTO users (role_id, institution_id, branch_id, name, email, password_hash, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        `, [roles['Branch'], instId, bId, `مدير ${branchName}`, `branch${bId}@inst.com`, hashedPassword]);

            // Branch Cashbox with initial balance
            const initialBalance = randomInt(50000, 200000);
            await client.query(`INSERT INTO cash_boxes (branch_id, institution_id, box_type, balance, is_active) VALUES ($1, $2, 'Branch', $3, TRUE)`,
                [bId, instId, initialBalance]);
        }
        console.log('✅ 30 Branches created with managers and cashboxes');

        // 6. Create 50 Customers
        const customers = [];
        for (let i = 0; i < 50; i++) {
            const name = customerNames[i];
            const instId = instIds[i % instIds.length];
            const branchId = branchIds[i % branchIds.length];
            const nationalId = `10${randomInt(10000000, 99999999)}`;
            const res = await client.query(`
            INSERT INTO customers (name, national_id, phone_number, institution_id, trust_status)
            VALUES ($1, $2, $3, $4, 'Trusted') RETURNING customer_id
        `, [name, nationalId, `05${randomInt(10000000, 99999999)}`, instId]);
            const cId = res.rows[0].customer_id;
            customers.push({ id: cId, instId, branchId });

            // Add relation
            await client.query(`INSERT INTO customer_relations (customer_id, institution_id, branch_id) VALUES ($1, $2, $3)`, [cId, instId, branchId]);
        }
        console.log('✅ 50 Customers created');

        // 7. Create 100+ Loans & Installments
        console.log('💰 Generating Loans and Installments... this may take a moment');
        for (let i = 0; i < 120; i++) {
            const customer = customers[i % customers.length];
            const pId = productIds[i % productIds.length];
            const amount = randomInt(5000, 50000);
            const profit = (amount * 0.2).toFixed(2); // 20% flat profit for seed
            const months = [3, 6, 12][randomInt(0, 2)];
            const createdAt = randomDate(new Date(2025, 0, 1), new Date()); // Loans created in 2025

            let status = 'Active';
            if (i % 5 === 0) status = 'Paid';
            if (i % 7 === 0) status = 'Late';

            const loanRes = await client.query(`
            INSERT INTO loans (customer_id, institution_id, branch_id, product_id, principal_amount, profit_amount, payment_plan_months, status, created_at, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (SELECT user_id FROM users WHERE branch_id = $3 LIMIT 1))
            RETURNING loan_id
        `, [customer.id, customer.instId, customer.branchId, pId, amount, profit, months, status, createdAt]);

            const loanId = loanRes.rows[0].loan_id;
            const instAmount = ((parseFloat(amount) + parseFloat(profit)) / months);

            // Generate Installments
            for (let m = 1; m <= months; m++) {
                const dueDate = new Date(createdAt);
                dueDate.setMonth(dueDate.getMonth() + m);

                let iStatus = 'Pending';
                let paymentDate = null;

                // Logic for paid/past installments
                if (status === 'Paid' || (status === 'Active' && dueDate < new Date() && Math.random() > 0.3)) {
                    iStatus = 'Paid';
                    paymentDate = new Date(dueDate);
                    paymentDate.setDate(paymentDate.getDate() - randomInt(0, 5));
                } else if (dueDate < new Date()) {
                    iStatus = i % 7 === 0 ? 'Late' : 'Pending';
                }

                await client.query(`
                INSERT INTO installments (loan_id, installment_number, due_date, amount, status, payment_date)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [loanId, m, dueDate, instAmount.toFixed(2), iStatus, paymentDate]);

                // Add transaction to history if paid
                if (iStatus === 'Paid') {
                    await client.query(`
                    INSERT INTO cash_box_transactions (cash_box_id, transaction_type, amount, balance_before, balance_after, description, loan_id, created_at)
                    VALUES ((SELECT cash_box_id FROM cash_boxes WHERE branch_id = $1), 'LoanPayment', $2, 0, 0, $3, $4, $5)
                `, [customer.branchId, instAmount.toFixed(2), `قسط ${m}/${months} - ${customer.id}`, loanId, paymentDate]);
                }
            }

            // Add disbursement transaction
            await client.query(`
            INSERT INTO cash_box_transactions (cash_box_id, transaction_type, amount, balance_before, balance_after, description, loan_id, created_at)
            VALUES ((SELECT cash_box_id FROM cash_boxes WHERE branch_id = $1), 'LoanDisbursement', $2, 0, 0, $3, $4, $5)
        `, [customer.branchId, amount, `صرف قرض رقم ${loanId}`, loanId, createdAt]);
        }

        // Fix cashbox balances based on transactions
        console.log('⚖️  Calculating final balances for cashboxes...');
        const boxes = await client.query("SELECT cash_box_id FROM cash_boxes");
        for (const box of boxes.rows) {
            const sumRes = await client.query(`
                SELECT SUM(
                    CASE 
                        WHEN transaction_type IN ('Deposit', 'LoanPayment', 'Subscription') THEN amount 
                        ELSE -amount 
                    END
                ) as total 
                FROM cash_box_transactions 
                WHERE cash_box_id = $1
            `, [box.cash_box_id]);

            const txTotal = parseFloat(sumRes.rows[0].total || 0);
            await client.query("UPDATE cash_boxes SET balance = balance + $1 WHERE cash_box_id = $2", [txTotal, box.cash_box_id]);
        }

        console.log('\n✅ SEEDING COMPLETE!');
        console.log('----------------------------------------------------');
        console.log('Summary:');
        console.log('- Super Admin: admin@q1key.com / 123456');
        console.log('- 20 Institutions with Admins (admin@inst0.com to admin@inst19.com)');
        console.log('- 30 Branches with Managers');
        console.log('- 50 Customers with 120 Loans');
        console.log('- Thousands of automated transactions and installments');
        console.log('----------------------------------------------------');

        await client.query('SET session_replication_role = DEFAULT;');

    } catch (error) {
        console.error('\n❌ ERROR SEEDING:', error);
    } finally {
        await client.end();
    }
}

bulkSeed();

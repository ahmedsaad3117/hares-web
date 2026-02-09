const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function clearDataKeepAdmin() {
    try {
        console.log('🔄 جاري تصفير قاعدة البيانات مع الحفاظ على حساب المدير...');
        await client.connect();
        console.log('✅ تم الاتصال بقاعدة البيانات');

        // تعطيل القيود المرجعية مؤقتاً
        await client.query('SET session_replication_role = replica;');

        // قائمة الجداول التي سيتم حذف بياناتها بالترتيب الصحيح
        const tables = [
            'search_logs',
            'cash_box_transactions',
            'cash_boxes',
            'installments',
            'loans',
            'customer_relations',
            'customer_notes',
            'customers',
            'products',
            'branches',
            'institutions',
            'announcements',
            'subscription_requests'
        ];

        for (const table of tables) {
            try {
                await client.query(`DELETE FROM ${table}`);
                console.log(`   ✓ تم حذف بيانات جدول: ${table}`);
            } catch (e) {
                console.log(`   ⚠️  تخطي جدول ${table}: ${e.message}`);
            }
        }

        // حذف جميع المستخدمين ما عدا الـ Super Admin
        try {
            await client.query(`DELETE FROM users WHERE email != 'admin@q1key.com'`);
            console.log('   ✓ تم حذف جميع المستخدمين الآخرين والحفاظ على admin@q1key.com');
        } catch (e) {
            console.log(`   ⚠️  خطأ في حذف المستخدمين: ${e.message}`);
        }

        // إعادة تمكين القيود المرجعية
        await client.query('SET session_replication_role = DEFAULT;');

        // إعادة تعيين التسلسلات (IDs) لتبدأ من جديد
        const sequences = [
            'institutions_institution_id_seq',
            'branches_branch_id_seq',
            'customers_customer_id_seq',
            'products_product_id_seq',
            'loans_loan_id_seq',
            'installments_installment_id_seq',
            'users_user_id_seq'
        ];

        for (const seq of sequences) {
            try {
                await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
            } catch (e) { }
        }

        console.log('\n✅ تمت العملية بنجاح! قاعدة البيانات الآن فارغة تماماً ما عدا حساب المدير العام.');
        console.log('📧 الحساب المتبقي: admin@q1key.com');

    } catch (error) {
        console.error('\n❌ خطأ غير متوقع:', error.message);
    } finally {
        await client.end();
    }
}

clearDataKeepAdmin();

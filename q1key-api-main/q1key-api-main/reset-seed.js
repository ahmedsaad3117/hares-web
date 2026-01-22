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

async function resetAndSeedDatabase() {
  try {
    console.log('🔄 بدء تصفير قاعدة البيانات وإضافة بيانات جديدة...\n');
    await client.connect();
    console.log('✅ تم الاتصال بقاعدة البيانات');

    // =============================================
    // الخطوة 1: حذف جميع البيانات القديمة
    // =============================================
    console.log('\n🗑️  جاري حذف البيانات القديمة...');

    // تعطيل القيود المرجعية مؤقتاً
    await client.query('SET session_replication_role = replica;');

    // Helper function to safely delete from a table
    async function safeDelete(tableName, displayName) {
      try {
        await client.query(`DELETE FROM ${tableName}`);
        console.log(`   ✓ حذف ${displayName || tableName}`);
        return true;
      } catch (e) {
        console.log(`   ⚠️  خطأ في حذف ${displayName || tableName}: ${e.message}`);
        return false;
      }
    }

    // حذف بالترتيب العكسي للعلاقات
    await safeDelete('search_logs', 'سجلات البحث');
    await safeDelete('cash_box_transactions', 'معاملات الصندوق');
    await safeDelete('cash_box', 'الصندوق');
    await safeDelete('installments', 'الأقساط');
    await safeDelete('loans', 'القروض');
    await safeDelete('customer_relations', 'علاقات العملاء');
    await safeDelete('customers', 'العملاء');
    await safeDelete('products', 'المنتجات');

    // حذف المستخدمين ما عدا Super Admin
    try {
      await client.query(`DELETE FROM users WHERE role_id != (SELECT role_id FROM roles WHERE role_name = 'Super Admin')`);
      console.log('   ✓ حذف المستخدمين (ما عدا Super Admin)');
    } catch (e) {
      console.log(`   ⚠️  خطأ في حذف المستخدمين: ${e.message}`);
    }

    await safeDelete('branches', 'الفروع');
    await safeDelete('institutions', 'المؤسسات');

    // إعادة تمكين القيود المرجعية
    await client.query('SET session_replication_role = DEFAULT;');

    console.log('\n✅ تم حذف جميع البيانات القديمة بنجاح!');

    // =============================================
    // الخطوة 2: إعادة تعيين التسلسلات (IDs)
    // =============================================
    console.log('\n🔢 جاري إعادة تعيين التسلسلات...');

    async function safeResetSequence(seqName, startWith = 1) {
      try {
        await client.query(`ALTER SEQUENCE ${seqName} RESTART WITH ${startWith}`);
      } catch (e) {
        // Sequence doesn't exist, skip
      }
    }

    await safeResetSequence('institutions_institution_id_seq');
    await safeResetSequence('branches_branch_id_seq');
    await safeResetSequence('customers_customer_id_seq');
    await safeResetSequence('products_product_id_seq');
    await safeResetSequence('loans_loan_id_seq');
    await safeResetSequence('installments_installment_id_seq');
    await safeResetSequence('customer_relations_id_seq');
    // Super Admin has user_id = 1, so start from 2
    await safeResetSequence('users_user_id_seq', 2);
    console.log('✅ تم إعادة تعيين التسلسلات');

    // =============================================
    // الخطوة 3: الحصول على role IDs
    // =============================================
    const superAdminRole = await client.query("SELECT role_id FROM roles WHERE role_name = 'Super Admin'");
    const institutionRole = await client.query("SELECT role_id FROM roles WHERE role_name = 'Institution'");
    const branchRole = await client.query("SELECT role_id FROM roles WHERE role_name = 'Branch'");

    const superAdminRoleId = superAdminRole.rows[0].role_id;
    const institutionRoleId = institutionRole.rows[0].role_id;
    const branchRoleId = branchRole.rows[0].role_id;

    // =============================================
    // الخطوة 4: تحديث Super Admin
    // =============================================
    console.log('\n👤 جاري تحديث مشرف النظام...');
    const hashedPassword = await bcrypt.hash('123456', 10);

    await client.query(`
      UPDATE users SET 
        name = 'مشرف النظام',
        email = 'admin@q1key.com',
        password_hash = $1
      WHERE role_id = $2
    `, [hashedPassword, superAdminRoleId]);
    console.log('✅ تم تحديث مشرف النظام');
    console.log('   📧 البريد: admin@q1key.com');
    console.log('   🔑 كلمة المرور: 123456');

    // =============================================
    // الخطوة 5: إضافة المؤسسات
    // =============================================
    console.log('\n🏢 جاري إضافة المؤسسات...');

    // المؤسسة الأولى
    await client.query(`
      INSERT INTO institutions (name, tax_id, phone_number, email, max_users, can_create_branches, is_active) 
      VALUES ('مؤسسة الأمانة للتمويل', '1234567890', '0501234567', 'info@alamana.com', 50, TRUE, TRUE)
    `);
    console.log('   ✓ مؤسسة الأمانة للتمويل');

    // المؤسسة الثانية
    await client.query(`
      INSERT INTO institutions (name, tax_id, phone_number, email, max_users, can_create_branches, is_active) 
      VALUES ('شركة الثقة للإقراض', '0987654321', '0559876543', 'info@althiqa.com', 30, TRUE, TRUE)
    `);
    console.log('   ✓ شركة الثقة للإقراض');

    console.log('✅ تم إضافة المؤسسات');

    // =============================================
    // الخطوة 6: إضافة الفروع
    // =============================================
    console.log('\n🏪 جاري إضافة الفروع...');

    // فروع مؤسسة الأمانة
    await client.query(`
      INSERT INTO branches (name, institution_id, phone_number) VALUES 
        ('فرع الرياض الرئيسي', 1, '0501111111'),
        ('فرع جدة', 1, '0502222222')
    `);
    console.log('   ✓ فرع الرياض الرئيسي (مؤسسة الأمانة)');
    console.log('   ✓ فرع جدة (مؤسسة الأمانة)');

    // فروع شركة الثقة
    await client.query(`
      INSERT INTO branches (name, institution_id, phone_number) VALUES 
        ('فرع الدمام', 2, '0503333333')
    `);
    console.log('   ✓ فرع الدمام (شركة الثقة)');

    console.log('✅ تم إضافة الفروع');

    // =============================================
    // الخطوة 7: إضافة مستخدمي المؤسسات والفروع
    // =============================================
    console.log('\n👥 جاري إضافة المستخدمين...');

    // مدير مؤسسة الأمانة
    await client.query(`
      INSERT INTO users (role_id, institution_id, name, email, phone_number, password_hash, is_active) 
      VALUES ($1, 1, 'أحمد المدير', 'ahmed@alamana.com', '0501111111', $2, TRUE)
    `, [institutionRoleId, hashedPassword]);
    console.log('   ✓ أحمد المدير (مدير مؤسسة الأمانة)');

    // مدير فرع الرياض
    await client.query(`
      INSERT INTO users (role_id, institution_id, branch_id, name, email, phone_number, password_hash, is_active) 
      VALUES ($1, 1, 1, 'سعد الفرعي', 'saad@alamana.com', '0502222222', $2, TRUE)
    `, [branchRoleId, hashedPassword]);
    console.log('   ✓ سعد الفرعي (مدير فرع الرياض)');

    // مدير فرع جدة
    await client.query(`
      INSERT INTO users (role_id, institution_id, branch_id, name, email, phone_number, password_hash, is_active) 
      VALUES ($1, 1, 2, 'خالد الجداوي', 'khaled@alamana.com', '0503333333', $2, TRUE)
    `, [branchRoleId, hashedPassword]);
    console.log('   ✓ خالد الجداوي (مدير فرع جدة)');

    // مدير شركة الثقة
    await client.query(`
      INSERT INTO users (role_id, institution_id, name, email, phone_number, password_hash, is_active) 
      VALUES ($1, 2, 'محمد الثقة', 'mohammed@althiqa.com', '0504444444', $2, TRUE)
    `, [institutionRoleId, hashedPassword]);
    console.log('   ✓ محمد الثقة (مدير شركة الثقة)');

    // مدير فرع الدمام
    await client.query(`
      INSERT INTO users (role_id, institution_id, branch_id, name, email, phone_number, password_hash, is_active) 
      VALUES ($1, 2, 3, 'عبدالله الدمامي', 'abdullah@althiqa.com', '0505555555', $2, TRUE)
    `, [branchRoleId, hashedPassword]);
    console.log('   ✓ عبدالله الدمامي (مدير فرع الدمام)');

    console.log('✅ تم إضافة المستخدمين');

    // =============================================
    // الخطوة 8: إضافة المنتجات
    // =============================================
    console.log('\n📦 جاري إضافة المنتجات...');
    await client.query(`
      INSERT INTO products (name, description, is_active) VALUES 
        ('قرض شخصي', 'قرض شخصي قصير المدة بأقساط مرنة', TRUE),
        ('قرض تجاري', 'قرض لتمويل المشاريع الصغيرة والمتوسطة', TRUE),
        ('قرض عقاري', 'تمويل طويل المدة لشراء العقارات', TRUE),
        ('قرض سيارة', 'تمويل لشراء السيارات الجديدة والمستعملة', TRUE)
    `);
    console.log('   ✓ قرض شخصي');
    console.log('   ✓ قرض تجاري');
    console.log('   ✓ قرض عقاري');
    console.log('   ✓ قرض سيارة');
    console.log('✅ تم إضافة المنتجات');

    // =============================================
    // الخطوة 9: إضافة العملاء
    // =============================================
    console.log('\n👤 جاري إضافة العملاء...');

    // عملاء مؤسسة الأمانة - فرع الرياض
    await client.query(`
      INSERT INTO customers (name, national_id, phone_number, institution_id, created_by, trust_status) VALUES 
        ('عبدالرحمن السعودي', '1111111111', '0551111111', 1, 3, 'Trusted'),
        ('فهد العتيبي', '2222222222', '0552222222', 1, 3, 'Unverified')
    `);
    // إضافة العلاقات
    await client.query(`
      INSERT INTO customer_relations (customer_id, institution_id, branch_id) VALUES 
        (1, 1, 1),
        (2, 1, 1)
    `);
    console.log('   ✓ عبدالرحمن السعودي (فرع الرياض)');
    console.log('   ✓ فهد العتيبي (فرع الرياض)');

    // عملاء مؤسسة الأمانة - فرع جدة
    await client.query(`
      INSERT INTO customers (name, national_id, phone_number, institution_id, created_by, trust_status) VALUES 
        ('سلطان الغامدي', '3333333333', '0553333333', 1, 4, 'Trusted')
    `);
    await client.query(`
      INSERT INTO customer_relations (customer_id, institution_id, branch_id) VALUES 
        (3, 1, 2)
    `);
    console.log('   ✓ سلطان الغامدي (فرع جدة)');

    // عملاء شركة الثقة - فرع الدمام
    await client.query(`
      INSERT INTO customers (name, national_id, phone_number, institution_id, created_by, trust_status) VALUES 
        ('ناصر الدوسري', '4444444444', '0554444444', 2, 6, 'Trusted'),
        ('تركي القحطاني', '5555555555', '0555555555', 2, 6, 'Blocked')
    `);
    await client.query(`
      INSERT INTO customer_relations (customer_id, institution_id, branch_id) VALUES 
        (4, 2, 3),
        (5, 2, 3)
    `);
    console.log('   ✓ ناصر الدوسري (فرع الدمام)');
    console.log('   ✓ تركي القحطاني (فرع الدمام)');

    console.log('✅ تم إضافة العملاء');

    // =============================================
    // ملخص البيانات
    // =============================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 تم تصفير وإعادة تعبئة قاعدة البيانات بنجاح!');
    console.log('='.repeat(60));

    console.log('\n📋 ملخص البيانات الجديدة:');
    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│ 👑 مشرف النظام (Super Admin)                                │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  البريد: admin@q1key.com                                    │');
    console.log('│  كلمة المرور: 123456                                        │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│ 🏢 مؤسسة الأمانة للتمويل                                     │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  مدير المؤسسة: ahmed@alamana.com / 123456                   │');
    console.log('│                                                             │');
    console.log('│  📍 فرع الرياض الرئيسي                                       │');
    console.log('│     مدير الفرع: saad@alamana.com / 123456                   │');
    console.log('│     العملاء: عبدالرحمن السعودي، فهد العتيبي                  │');
    console.log('│                                                             │');
    console.log('│  📍 فرع جدة                                                  │');
    console.log('│     مدير الفرع: khaled@alamana.com / 123456                 │');
    console.log('│     العملاء: سلطان الغامدي                                   │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│ 🏢 شركة الثقة للإقراض                                        │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  مدير المؤسسة: mohammed@althiqa.com / 123456                │');
    console.log('│                                                             │');
    console.log('│  📍 فرع الدمام                                               │');
    console.log('│     مدير الفرع: abdullah@althiqa.com / 123456               │');
    console.log('│     العملاء: ناصر الدوسري، تركي القحطاني                     │');
    console.log('└─────────────────────────────────────────────────────────────┘');

    console.log('\n📦 المنتجات: قرض شخصي، قرض تجاري، قرض عقاري، قرض سيارة');
    console.log('\n🔑 جميع كلمات المرور: 123456');

  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

resetAndSeedDatabase();

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

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');
    await client.connect();
    console.log('✅ Connected to database');

    // Check if roles exist
    const rolesCheck = await client.query('SELECT COUNT(*) FROM roles');
    if (parseInt(rolesCheck.rows[0].count) > 0) {
      console.log('⚠️  Database already seeded. Skipping...');
      await client.end();
      return;
    }

    // Insert roles
    console.log('\n📝 Inserting roles...');
    await client.query(`
      INSERT INTO roles (role_name) VALUES 
        ('Super Admin'),
        ('Institution'),
        ('Branch')
    `);
    console.log('✅ Roles created: Super Admin, Institution, Branch');

    // Get role IDs
    const superAdminRole = await client.query(
      "SELECT role_id FROM roles WHERE role_name = 'Super Admin'"
    );
    const superAdminRoleId = superAdminRole.rows[0].role_id;

    // Hash password for admin user
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Insert Super Admin user
    console.log('\n👤 Creating Super Admin user...');
    await client.query(`
      INSERT INTO users (role_id, name, email, password_hash, is_active) 
      VALUES ($1, $2, $3, $4, $5)
    `, [superAdminRoleId, 'System Admin', 'admin@hares.com', hashedPassword, true]);
    console.log('✅ Super Admin created');
    console.log('   Email: admin@hares.com');
    console.log('   Password: 123456');

    // Insert sample institution
    console.log('\n🏢 Creating sample institution...');
    await client.query(`
      INSERT INTO institutions (name, max_users) 
      VALUES ('Main Financial Institution', 100)
    `);
    console.log('✅ Institution created: Main Financial Institution');

    // Insert sample branch
    console.log('\n🏪 Creating sample branch...');
    await client.query(`
      INSERT INTO branches (name, institution_id) 
      VALUES ('Downtown Branch', 1)
    `);
    console.log('✅ Branch created: Downtown Branch');

    // Insert sample customers
    console.log('\n👥 Creating sample customers...');
    await client.query(`
      INSERT INTO customers (name, national_id, phone_number) VALUES 
        ('John Doe', '1234567890', '+1234567890'),
        ('Jane Smith', '0987654321', '+0987654321')
    `);
    console.log('✅ Customers created: John Doe, Jane Smith');

    // Insert sample products
    console.log('\n📦 Creating loan products...');
    await client.query(`
      INSERT INTO products (name, description, is_active) VALUES 
        ('Personal Loan', 'Short-term personal loan with flexible repayment', TRUE),
        ('Business Loan', 'Loan for small and medium businesses', TRUE),
        ('Home Loan', 'Long-term home financing solution', TRUE)
    `);
    console.log('✅ Products created: Personal Loan, Business Loan, Home Loan');

    // Insert sample loans
    console.log('\n💰 Creating sample loans...');
    await client.query(`
      INSERT INTO loans (customer_id, branch_id, product_id, principal_amount, status, due_date) VALUES 
        (1, 1, 1, 10000.00, 'Active', CURRENT_DATE + INTERVAL '30 days'),
        (2, 1, 2, 50000.00, 'Active', CURRENT_DATE + INTERVAL '60 days')
    `);
    console.log('✅ Sample loans created');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📌 You can now login with:');
    console.log('   Email: admin@hares.com');
    console.log('   Password: 123456');
    console.log('\n🌐 API: http://localhost:8080/api');
    console.log('🌐 Frontend: http://localhost:3000');

  } catch (error) {
    console.error('\n❌ Error seeding database:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

seedDatabase();

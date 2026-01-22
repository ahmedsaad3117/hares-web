const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hares_db',
});

async function checkAndCreateTable() {
    try {
        await client.connect();
        console.log('✅ Connected to database');

        console.log('Checking system_settings table...');

        // Check if table exists
        const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'system_settings'
      );
    `);

        if (!res.rows[0].exists) {
            console.log('Table does not exist. Creating system_settings table...');

            await client.query(`
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(100) UNIQUE NOT NULL,
          value TEXT,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
            console.log('✅ Table system_settings created successfully!');

            // Insert default values
            console.log('Inserting default support info...');
            await client.query(`
        INSERT INTO system_settings (key, value, description) VALUES
        ('support.whatsapp', '966500000000', 'Support WhatsApp Number'),
        ('support.email', 'support@q1key.com', 'Support Email Address')
        ON CONFLICT (key) DO NOTHING;
      `);
            console.log('✅ Default values inserted.');

        } else {
            console.log('✅ Table system_settings already exists.');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

checkAndCreateTable();

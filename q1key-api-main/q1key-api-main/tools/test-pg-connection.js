const { Client } = require('pg');

// Try different password combinations
const passwords = ['', 'admin', 'root', '123456', '1234', 'password', 'postgres', '303101'];

async function testConnection(password) {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: password,
    database: 'postgres',
  });

  try {
    console.log(`\nTrying password: "${password || '(empty)'}"`);
    await client.connect();
    console.log('✅ Connected successfully!');

    const res = await client.query('SELECT version()');
    console.log('PostgreSQL version:', res.rows[0].version);

    // Check if hares_db exists
    const dbRes = await client.query(
      "SELECT datname FROM pg_database WHERE datname = 'hares_db'"
    );

    if (dbRes.rows.length > 0) {
      console.log('✅ Database hares_db exists');
    } else {
      console.log('❌ Database hares_db does NOT exist - creating it...');
      await client.query('CREATE DATABASE hares_db');
      console.log('✅ Database created successfully!');
    }

    console.log('\n🎉 SUCCESS! Use this password in your .env file');
    await client.end();
    return true;

  } catch (err) {
    console.log(`❌ Failed: ${err.message}`);
    await client.end();
    return false;
  }
}

async function tryAllPasswords() {
  console.log('Testing PostgreSQL connection with different passwords...\n');

  for (const pwd of passwords) {
    const success = await testConnection(pwd);
    if (success) {
      break;
    }
  }
}

tryAllPasswords();

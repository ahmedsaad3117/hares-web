
const { DataSource } = require('typeorm');
const path = require('path');

async function checkUser() {
    const dataSource = new DataSource({
        type: 'sqlite',
        database: path.join(__dirname, 'q1key-api-main', 'q1key-api-main', 'database.sqlite'), // Assuming SQLite based on project structure
        entities: [path.join(__dirname, 'q1key-api-main', 'q1key-api-main', 'src', 'entities', '*.entity.ts')],
        synchronize: false,
    });

    // Since I don't know the exact DB config from here, I'll try to use a simpler approach if it's SQLite.
    // Or better, just grep the database file if it's text, or use sqlite3 command.
}

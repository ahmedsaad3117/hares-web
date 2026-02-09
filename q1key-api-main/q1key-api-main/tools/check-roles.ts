import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    logging: false,
});

async function checkRoles() {
    try {
        await AppDataSource.initialize();
        console.log('Connected to database');

        const roles = await AppDataSource.query('SELECT * FROM roles');
        console.log('Roles:', roles);

        const currentUser = await AppDataSource.query('SELECT u.*, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.role_id WHERE u.email = \'admin@q1key.com\'');
        console.log('Current User (Admin):', currentUser);

        await AppDataSource.destroy();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkRoles();

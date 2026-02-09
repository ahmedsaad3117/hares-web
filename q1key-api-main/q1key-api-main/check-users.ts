import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

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

async function checkUsers() {
    try {
        await AppDataSource.initialize();
        console.log('Connected to database');

        const users = await AppDataSource.query(`
      SELECT u.user_id, u.name, u.email, r.role_name, u.institution_id, i.name as institution_name
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.role_id
      LEFT JOIN institutions i ON u.institution_id = i.institution_id
    `);
        console.log('Users:', users);

        await AppDataSource.destroy();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkUsers();

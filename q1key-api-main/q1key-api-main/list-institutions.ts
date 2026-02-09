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

async function listInstitutions() {
    try {
        await AppDataSource.initialize();
        console.log('Connected to database');

        const institutions = await AppDataSource.query('SELECT * FROM institutions');
        console.log('Institutions:', institutions);

        await AppDataSource.destroy();
    } catch (error) {
        console.error('Error:', error);
    }
}

listInstitutions();

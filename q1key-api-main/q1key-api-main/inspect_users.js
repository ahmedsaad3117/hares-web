const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { UsersService } = require('./dist/modules/users/users.service');

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);

    const users = await usersService.findAll({ page: 1, limit: 100 });
    console.log('--- Users List ---');
    users.data.forEach(u => {
        console.log(`ID: ${u.userId}, Email: ${u.email}, Role: ${u.role ? u.role.roleName : 'N/A'}`);
    });

    await app.close();
}

bootstrap();

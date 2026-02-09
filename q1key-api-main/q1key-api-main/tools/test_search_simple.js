const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { UsersService } = require('./dist/modules/users/users.service');

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);

    console.log('Testing search for "mohammed"...');
    const result = await usersService.findAll({ page: 1, limit: 10, search: 'mohammed' });
    console.log(`Found ${result.meta.total} results.`);
    result.data.forEach(u => console.log(`- ${u.name} | ${u.email}`));

    await app.close();
}

bootstrap();

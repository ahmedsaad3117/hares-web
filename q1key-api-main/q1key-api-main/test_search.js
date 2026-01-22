const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { UsersService } = require('./dist/modules/users/users.service');

async function bootstrap() {
    try {
        const app = await NestFactory.createApplicationContext(AppModule);
        const usersService = app.get(UsersService);

        console.log('Testing search for "Mohammed"...');
        const result = await usersService.findAll({ page: 1, limit: 10, search: 'Mohammed' });
        console.log(`Found ${result.meta.total} results.`);
        result.data.forEach(u => console.log(`- ${u.name} (${u.email})`));

        console.log('\nTesting search for "mohammed" (lowercase)...');
        const resultLower = await usersService.findAll({ page: 1, limit: 10, search: 'mohammed' });
        console.log(`Found ${resultLower.meta.total} results.`);
        resultLower.data.forEach(u => console.log(`- ${u.name} (${u.email})`));

        console.log('\nTesting search for "5" (ID)...');
        const resultId = await usersService.findAll({ page: 1, limit: 10, search: '5' });
        console.log(`Found ${resultId.meta.total} results.`);
        resultId.data.forEach(u => console.log(`- [${u.userId}] ${u.name}`));


        await app.close();
    } catch (e) {
        console.error(e);
    }
}

bootstrap();

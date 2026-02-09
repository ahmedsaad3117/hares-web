const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { UsersService } = require('./dist/modules/users/users.service');

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);

    console.log('--- Testing Search Logic ---');

    // Test 1: Full Name "Mohammed Althiqa" (Assuming first name is Mohammed and last name/institution is Althiqa)
    // Based on previous logs: Name: "محمد الثقة", Email: "mohammed@althiqa.com", Inst: "شركة الثقة للإقراض"

    console.log('\n1. Searching for "Mohammed Althiqa"...');
    const res1 = await usersService.findAll({ page: 1, limit: 10, search: 'Mohammed Althiqa' });
    console.log(`Found: ${res1.meta.total}`);
    res1.data.forEach(u => console.log(`   - ${u.name} | ${u.email} | ${u.institutionName}`));

    console.log('\n2. Searching for "محمد الثقة"...');
    const res2 = await usersService.findAll({ page: 1, limit: 10, search: 'محمد الثقة' });
    console.log(`Found: ${res2.meta.total}`);
    res2.data.forEach(u => console.log(`   - ${u.name} | ${u.email}`));

    console.log('\n3. Searching for "5"...');
    const res3 = await usersService.findAll({ page: 1, limit: 10, search: '5' });
    console.log(`Found: ${res3.meta.total}`);
    res3.data.forEach(u => console.log(`   - [#${u.userId}] ${u.name}`));

    await app.close();
}

bootstrap();

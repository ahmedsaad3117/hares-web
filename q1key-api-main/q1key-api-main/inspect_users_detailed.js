const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { UsersService } = require('./dist/modules/users/users.service');

async function bootstrap() {
    try {
        const app = await NestFactory.createApplicationContext(AppModule);
        const usersService = app.get(UsersService);

        // Call findAll but without specific search to see raw data
        const result = await usersService.findAll({ page: 1, limit: 100 });

        console.log('--- Detailed User List ---');
        result.data.forEach(u => {
            console.log(JSON.stringify({
                id: u.userId,
                name: u.name,
                email: u.email,
                institution: u.institutionName,
                branch: u.branchName
            }, null, 2));
        });

        await app.close();
    } catch (e) {
        console.error(e);
    }
}

bootstrap();

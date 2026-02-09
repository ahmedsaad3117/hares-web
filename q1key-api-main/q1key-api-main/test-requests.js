
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module');
const { SubscriptionsService } = require('./dist/src/modules/subscriptions/subscriptions.service');

async function test() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const service = app.get(SubscriptionsService);
    try {
        const result = await service.getUnifiedRequests({ status: 'Pending' });
        console.log('RESULT:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('ERROR:', e);
    }
    await app.close();
}

test();

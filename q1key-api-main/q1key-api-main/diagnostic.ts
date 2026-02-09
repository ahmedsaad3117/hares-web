
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { TelegramService } from './src/modules/telegram/telegram.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const telegramService = app.get(TelegramService);

    console.log('--- Telegram Diagnostic ---');
    const settings = await telegramService.getSettings();

    if (!settings) {
        console.log('❌ No settings found in DB');
    } else {
        console.log('✅ Settings found:', {
            isEnabled: settings.isEnabled,
            hasToken: !!settings.botToken,
            hasChatId: !!settings.chatId,
            notifyNewRequests: settings.notifyNewRequests,
        });

        if (settings.isEnabled && settings.botToken && settings.chatId) {
            console.log('🚀 Attempting to send diagnostic message...');
            const result = await telegramService.sendTelegramMessage(
                settings.botToken,
                settings.chatId,
                '🧪 *رسالة تشخيصية*\nهذه الرسالة تم إرسالها لاختبار نظام الإشعارات في Q1KEY.'
            );
            console.log('📊 Result:', result.success ? 'SUCCESS ✅' : 'FAILED ❌', result.error || '');
        } else {
            console.log('⚠️ Telegram not enabled or missing configuration');
        }
    }

    await app.close();
}

bootstrap().catch(err => console.error('FATAL:', err));

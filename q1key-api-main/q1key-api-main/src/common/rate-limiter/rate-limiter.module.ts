import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimiterService, RateLimiterGuard } from './rate-limiter.service';

/**
 * Global Rate Limiter Module
 * 
 * Provides rate limiting functionality across the entire application.
 * Import this module once in AppModule.
 */
@Global()
@Module({
    imports: [ConfigModule],
    providers: [RateLimiterService, RateLimiterGuard],
    exports: [RateLimiterService, RateLimiterGuard],
})
export class RateLimiterModule { }

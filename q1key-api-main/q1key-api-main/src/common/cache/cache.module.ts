import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service';

/**
 * Global Cache Module
 * 
 * This module provides a simple in-memory cache service
 * that can be used across the entire application.
 * 
 * It is marked as @Global so you don't need to import it
 * in every module that needs caching.
 */
@Global()
@Module({
    imports: [ConfigModule],
    providers: [CacheService],
    exports: [CacheService],
})
export class CacheModule { }

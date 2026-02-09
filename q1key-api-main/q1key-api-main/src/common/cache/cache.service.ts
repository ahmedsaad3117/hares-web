import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Simple In-Memory Cache Service
 * 
 * Features:
 * - TTL (Time To Live) support
 * - Namespace-based cache keys
 * - Easy enable/disable via environment variable
 * - Automatic cleanup of expired entries
 * - Thread-safe operations
 * 
 * Usage:
 *   this.cacheService.get('stats:general', () => this.calculateStats(), 300);
 * 
 * Environment Variables:
 *   CACHE_ENABLED=true|false (default: true)
 *   CACHE_DEFAULT_TTL=300 (default: 300 seconds)
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
    createdAt: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    enabled: boolean;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private enabled: boolean;
    private defaultTTL: number;
    private cleanupInterval: NodeJS.Timeout | null = null;

    // Statistics
    private hits: number = 0;
    private misses: number = 0;

    constructor(private configService: ConfigService) {
        // Read configuration
        this.enabled = this.configService.get<string>('CACHE_ENABLED', 'true') === 'true';
        this.defaultTTL = parseInt(this.configService.get<string>('CACHE_DEFAULT_TTL', '300'), 10);

        if (this.enabled) {
            // Start cleanup interval (every 60 seconds)
            this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
            console.log(`✅ Cache Service initialized (TTL: ${this.defaultTTL}s)`);
        } else {
            console.log('⚠️ Cache Service is DISABLED');
        }
    }

    onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
    }

    /**
     * Get value from cache or execute factory function
     * 
     * @param key - Unique cache key (use namespace:identifier format)
     * @param factory - Async function to get data if not cached
     * @param ttlSeconds - Time to live in seconds (default: from config)
     * @returns Cached or fresh value
     */
    async get<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
        // If cache is disabled, always execute factory
        if (!this.enabled) {
            return factory();
        }

        const now = Date.now();
        const cached = this.cache.get(key);

        // Return cached value if valid
        if (cached && cached.expiresAt > now) {
            this.hits++;
            return cached.value;
        }

        // Execute factory to get fresh data
        this.misses++;
        const value = await factory();

        // Store in cache
        const ttl = (ttlSeconds || this.defaultTTL) * 1000;
        this.cache.set(key, {
            value,
            expiresAt: now + ttl,
            createdAt: now,
        });

        return value;
    }

    /**
     * Get value synchronously (for pre-cached data only)
     */
    getSync<T>(key: string): T | null {
        if (!this.enabled) return null;

        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            this.hits++;
            return cached.value;
        }
        return null;
    }

    /**
     * Set value in cache manually
     */
    set<T>(key: string, value: T, ttlSeconds?: number): void {
        if (!this.enabled) return;

        const now = Date.now();
        const ttl = (ttlSeconds || this.defaultTTL) * 1000;

        this.cache.set(key, {
            value,
            expiresAt: now + ttl,
            createdAt: now,
        });
    }

    /**
     * Invalidate a specific cache key
     */
    invalidate(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Invalidate all keys matching a pattern (namespace)
     * Example: invalidatePattern('stats:') removes all stats cache
     */
    invalidatePattern(pattern: string): number {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(pattern)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return {
            hits: this.hits,
            misses: this.misses,
            size: this.cache.size,
            enabled: this.enabled,
        };
    }

    /**
     * Check if cache is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Enable cache at runtime
     */
    enable(): void {
        this.enabled = true;
        if (!this.cleanupInterval) {
            this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
        }
    }

    /**
     * Disable cache at runtime
     */
    disable(): void {
        this.enabled = false;
        this.clear();
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Remove expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt <= now) {
                this.cache.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            console.log(`🧹 Cache cleanup: removed ${removed} expired entries`);
        }
    }
}

// =====================================================
// CACHE KEY CONSTANTS
// Use these to ensure consistent key naming across the app
// =====================================================
export const CACHE_KEYS = {
    // Statistics (TTL: 5 minutes)
    STATS_GENERAL: (institutionId?: number) =>
        `stats:general:${institutionId ?? 'all'}`,
    STATS_SYSTEM: 'stats:system',

    // Institutions (TTL: 10 minutes)
    INSTITUTION_LIST: 'institutions:list',
    INSTITUTION_DETAIL: (id: number) => `institutions:detail:${id}`,
    INSTITUTION_STATS: (id: number) => `institutions:stats:${id}`,

    // Branches (TTL: 10 minutes)
    BRANCH_LIST: (institutionId?: number) =>
        `branches:list:${institutionId ?? 'all'}`,
    BRANCH_DETAIL: (id: number) => `branches:detail:${id}`,

    // Products (TTL: 30 minutes - rarely change)
    PRODUCT_LIST: (institutionId?: number) =>
        `products:list:${institutionId ?? 'all'}`,
    PRODUCT_ACTIVE: (institutionId?: number) =>
        `products:active:${institutionId ?? 'all'}`,

    // Subscription Plans (TTL: 1 hour - rarely change)
    SUBSCRIPTION_PLANS: 'subscriptions:plans',
    SUBSCRIPTION_PLANS_ACTIVE: 'subscriptions:plans:active',

    // Homepage Settings (TTL: 1 hour)
    HOMEPAGE_PUBLIC: 'homepage:public',
    HOMEPAGE_SETTINGS: 'homepage:settings',

    // Announcements (TTL: 5 minutes)
    ANNOUNCEMENT_ACTIVE: 'announcements:active',

    // Settings (TTL: 1 hour)
    SETTINGS_SUPPORT: 'settings:support',

    // Quick Links (TTL: 30 minutes)
    QUICK_LINKS_ACTIVE: 'quicklinks:active',
};

// TTL values in seconds
export const CACHE_TTL = {
    VERY_SHORT: 60,       // 1 minute - for frequently changing data
    SHORT: 300,           // 5 minutes - for statistics
    MEDIUM: 600,          // 10 minutes - for entity lists
    LONG: 1800,           // 30 minutes - for semi-static data
    VERY_LONG: 3600,      // 1 hour - for static data
};

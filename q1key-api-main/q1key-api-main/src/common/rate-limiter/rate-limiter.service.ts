import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

/**
 * Rate Limiter Service & Guard
 * 
 * Simple in-memory rate limiting implementation.
 * For production with multiple instances, consider using Redis.
 * 
 * Features:
 * - Per-IP rate limiting
 * - Per-user rate limiting (when authenticated)
 * - Configurable limits per route/action
 * - Automatic cleanup of expired entries
 * - Sliding window algorithm
 * 
 * Environment Variables:
 *   RATE_LIMIT_ENABLED=true|false (default: true)
 */

// Rate limit configuration interface
export interface RateLimitConfig {
    /** Maximum requests allowed in the window */
    limit: number;
    /** Time window in seconds */
    windowSeconds: number;
    /** Optional: use user ID instead of IP for authenticated users */
    perUser?: boolean;
    /** Optional: custom key prefix */
    keyPrefix?: string;
    /** Optional: skip rate limiting for certain roles */
    skipRoles?: string[];
}

// Decorator metadata key
export const RATE_LIMIT_KEY = 'rateLimit';

// Decorator to apply rate limiting to routes
export function RateLimit(config: RateLimitConfig) {
    return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
        if (descriptor) {
            // Method decorator
            Reflect.defineMetadata(RATE_LIMIT_KEY, config, descriptor.value);
            return descriptor;
        }
        // Class decorator
        Reflect.defineMetadata(RATE_LIMIT_KEY, config, target);
        return target;
    };
}

// Predefined rate limit configurations
export const RATE_LIMITS = {
    // Login: 5 attempts per minute (prevent brute force)
    LOGIN: { limit: 5, windowSeconds: 60, keyPrefix: 'login' } as RateLimitConfig,

    // Login strict: 10 attempts per 15 minutes (after failures)
    LOGIN_STRICT: { limit: 10, windowSeconds: 900, keyPrefix: 'login_strict' } as RateLimitConfig,

    // Search: 30 requests per minute (prevent abuse)
    SEARCH: { limit: 30, windowSeconds: 60, perUser: true, keyPrefix: 'search' } as RateLimitConfig,

    // Reports: 10 requests per minute (heavy queries)
    REPORTS: { limit: 10, windowSeconds: 60, perUser: true, keyPrefix: 'reports', skipRoles: ['Super Admin'] } as RateLimitConfig,

    // General API: 100 requests per minute
    GENERAL: { limit: 100, windowSeconds: 60, perUser: true, keyPrefix: 'api' } as RateLimitConfig,

    // Password reset: 3 attempts per hour
    PASSWORD_RESET: { limit: 3, windowSeconds: 3600, keyPrefix: 'pwd_reset' } as RateLimitConfig,

    // Registration/Subscription: 5 attempts per hour
    REGISTRATION: { limit: 5, windowSeconds: 3600, keyPrefix: 'register' } as RateLimitConfig,
};

// Rate limit entry storage
interface RateLimitEntry {
    count: number;
    firstRequest: number;
    windowEnd: number;
}

@Injectable()
export class RateLimiterService {
    private store: Map<string, RateLimitEntry> = new Map();
    private enabled: boolean;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(private configService: ConfigService) {
        this.enabled = this.configService.get<string>('RATE_LIMIT_ENABLED', 'true') === 'true';

        if (this.enabled) {
            // Cleanup expired entries every 5 minutes
            this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
            console.log('✅ Rate Limiter initialized');
        } else {
            console.log('⚠️ Rate Limiter is DISABLED');
        }
    }

    /**
     * Check if request should be allowed
     * @returns true if allowed, throws HttpException if blocked
     */
    checkLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
        if (!this.enabled) {
            return { allowed: true, remaining: config.limit, resetTime: 0 };
        }

        const now = Date.now();
        const fullKey = `${config.keyPrefix || 'default'}:${key}`;
        const entry = this.store.get(fullKey);

        // No entry or window expired - create new
        if (!entry || now > entry.windowEnd) {
            this.store.set(fullKey, {
                count: 1,
                firstRequest: now,
                windowEnd: now + (config.windowSeconds * 1000),
            });
            return {
                allowed: true,
                remaining: config.limit - 1,
                resetTime: now + (config.windowSeconds * 1000)
            };
        }

        // Within window - check limit
        if (entry.count >= config.limit) {
            const retryAfter = Math.ceil((entry.windowEnd - now) / 1000);
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.windowEnd
            };
        }

        // Increment counter
        entry.count++;
        return {
            allowed: true,
            remaining: config.limit - entry.count,
            resetTime: entry.windowEnd
        };
    }

    /**
     * Reset limit for a specific key (e.g., after successful login)
     */
    resetLimit(key: string, keyPrefix: string = 'default'): void {
        this.store.delete(`${keyPrefix}:${key}`);
    }

    /**
     * Get remaining requests for a key
     */
    getRemaining(key: string, config: RateLimitConfig): number {
        const fullKey = `${config.keyPrefix || 'default'}:${key}`;
        const entry = this.store.get(fullKey);

        if (!entry || Date.now() > entry.windowEnd) {
            return config.limit;
        }

        return Math.max(0, config.limit - entry.count);
    }

    /**
     * Get statistics
     */
    getStats(): { enabled: boolean; activeKeys: number } {
        return {
            enabled: this.enabled,
            activeKeys: this.store.size,
        };
    }

    /**
     * Enable rate limiting at runtime
     */
    enable(): void {
        this.enabled = true;
        if (!this.cleanupInterval) {
            this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        }
    }

    /**
     * Disable rate limiting at runtime
     */
    disable(): void {
        this.enabled = false;
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.store.clear();
    }

    /**
     * Remove expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.store.entries()) {
            if (now > entry.windowEnd) {
                this.store.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            console.log(`🧹 Rate Limiter cleanup: removed ${removed} expired entries`);
        }
    }
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private rateLimiter: RateLimiterService,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        // Get rate limit config from decorator
        const config = this.reflector.get<RateLimitConfig>(
            RATE_LIMIT_KEY,
            context.getHandler(),
        ) || this.reflector.get<RateLimitConfig>(
            RATE_LIMIT_KEY,
            context.getClass(),
        );

        // No rate limit config - allow
        if (!config) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // Check if user role should skip rate limiting
        if (config.skipRoles && user?.roleName) {
            if (config.skipRoles.includes(user.roleName)) {
                return true;
            }
        }

        // Determine key: user ID or IP
        let key: string;
        if (config.perUser && user?.userId) {
            key = `user:${user.userId}`;
        } else {
            // Get IP from various headers (for proxies) or connection
            key = `ip:${this.getClientIp(request)}`;
        }

        // Check rate limit
        const result = this.rateLimiter.checkLimit(key, config);

        // Set rate limit headers
        const response = context.switchToHttp().getResponse();
        response.setHeader('X-RateLimit-Limit', config.limit);
        response.setHeader('X-RateLimit-Remaining', result.remaining);
        response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

        if (!result.allowed) {
            const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
            response.setHeader('Retry-After', retryAfter);

            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد قليل.',
                    messageEn: 'Too many requests. Please try again later.',
                    retryAfter,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        return true;
    }

    /**
     * Get client IP address from request
     */
    private getClientIp(request: any): string {
        return (
            request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            request.headers['x-real-ip'] ||
            request.connection?.remoteAddress ||
            request.socket?.remoteAddress ||
            request.ip ||
            'unknown'
        );
    }
}

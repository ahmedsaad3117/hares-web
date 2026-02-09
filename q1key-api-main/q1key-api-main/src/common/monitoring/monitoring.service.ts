import { Injectable, Logger } from '@nestjs/common';

/**
 * Monitoring Service
 * 
 * Handles centralized logging for security events, performance issues,
 * and abnormal system behavior.
 */
@Injectable()
export class MonitoringService {
    private readonly logger = new Logger('Monitoring');
    private readonly securityLogger = new Logger('Security');
    private readonly perfLogger = new Logger('Performance');

    /**
     * Log authentication failure
     */
    logAuthFailure(identifier: string, ip: string, reason: string) {
        this.securityLogger.warn(
            `[Auth Failure] Identifier: ${identifier} | IP: ${ip} | Reason: ${reason}`
        );
    }

    /**
     * Log slow requests
     */
    logSlowRequest(method: string, url: string, duration: number, userId?: string) {
        this.perfLogger.warn(
            `[Slow Request] ${method} ${url} took ${duration}ms | User: ${userId || 'Guest'}`
        );
    }

    /**
     * Log abnormal requests (e.g., massive payloads, suspicious paths)
     */
    logAbnormalRequest(method: string, url: string, reason: string, details?: any) {
        this.logger.warn(
            `[Abnormal Request] ${method} ${url} | Reason: ${reason} | Details: ${JSON.stringify(details)}`
        );
    }

    /**
     * Log system warnings
     */
    logWarning(context: string, message: string) {
        this.logger.warn(`[${context}] ${message}`);
    }

    /**
     * Log critical errors
     */
    logError(context: string, message: string, stack?: string) {
        this.logger.error(`[${context}] ${message}`, stack);
    }
}

import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MonitoringService } from './monitoring.service';

/**
 * Monitoring Interceptor
 * 
 * Intercepts every request to:
 * 1. Measure execution time (detect slow queries/requests)
 * 2. Detect abnormal request patterns (size, frequency)
 * 3. Log basic request telemetry
 */
@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
    // Threshold for slow requests in milliseconds
    private readonly SLOW_THRESHOLD = 1000;
    // Threshold for large request payloads in bytes (e.g., 500KB)
    private readonly LARGE_PAYLOAD_THRESHOLD = 500 * 1024;

    constructor(private readonly monitoringService: MonitoringService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, user, headers } = request;
        const startTime = Date.now();

        // Check for abnormal payload size
        const contentLength = parseInt(headers['content-length'] || '0', 10);
        if (contentLength > this.LARGE_PAYLOAD_THRESHOLD) {
            this.monitoringService.logAbnormalRequest(
                method,
                url,
                'Large Payload',
                { size: `${(contentLength / 1024).toFixed(2)} KB` }
            );
        }

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - startTime;

                // Log slow requests
                if (duration > this.SLOW_THRESHOLD) {
                    this.monitoringService.logSlowRequest(
                        method,
                        url,
                        duration,
                        user?.userId
                    );
                }
            }),
        );
    }
}

import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global Exception Filter
 * 
 * Functions:
 * 1. Catch all unhandled exceptions
 * 2. Unify error response format
 * 3. Log errors internally for debugging
 * 4. Hide sensitive technical details from clients
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter');

    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        // Build specialized response based on exception type
        const errorResponse = this.getErrorResponse(exception, status, request);

        // Internal Logging
        this.logError(exception, status, request);

        // Send unified response
        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            ...errorResponse,
        });
    }

    /**
     * Extract or create meaningful error messages
     */
    private getErrorResponse(exception: any, status: number, request: Request) {
        const isAr = request.headers['accept-language']?.includes('ar') || true;

        // Default system error
        let message = 'خطأ داخلي في الخادم';
        let messageEn = 'Internal server error';
        let details = null;

        if (exception instanceof HttpException) {
            const res: any = exception.getResponse();

            // Handle NestJS built-in validation errors
            if (typeof res === 'object') {
                message = res.messageAr || res.message || message;
                messageEn = res.messageEn || (typeof res.message === 'string' ? res.message : messageEn);
                details = res.message; // Detailed validation errors
            } else {
                message = res;
            }
        } else {
            // For non-HttpExceptions (like database errors)
            // We hide the technical message from the user in production
            if (process.env.NODE_ENV === 'development') {
                details = exception.message;
            }
        }

        return {
            message: Array.isArray(message) ? message[0] : message,
            messageEn: Array.isArray(messageEn) ? messageEn[0] : messageEn,
            details: details,
        };
    }

    /**
     * Log error details internally
     */
    private logError(exception: any, status: number, request: Request) {
        const { method, url, body, query, user } = request as any;
        const userId = user?.userId || 'Guest';

        const logMessage = `
[Error] ${method} ${url}
Status: ${status}
User ID: ${userId}
Params: ${JSON.stringify(query)}
Payload: ${JSON.stringify(body)}
Message: ${exception.message || exception}
Stack: ${exception.stack || 'No stack trace'}
-------------------------------------------------------`;

        if (status >= 500) {
            this.logger.error(logMessage);
        } else {
            this.logger.warn(`[${status}] ${method} ${url} - User: ${userId} - ${exception.message || 'Client Error'}`);
        }
    }
}

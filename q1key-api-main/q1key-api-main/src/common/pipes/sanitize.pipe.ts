import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * SanitizePipe
 * 
 * Automatically trims strings and strips potentially dangerous HTML/Script tags
 * to prevent XSS attacks while maintaining a good user experience.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        if (typeof value === 'object' && value !== null) {
            return this.sanitizeObject(value);
        }

        if (typeof value === 'string') {
            return this.sanitizeString(value);
        }

        return value;
    }

    private sanitizeObject(obj: any): any {
        const sanitized: any = Array.isArray(obj) ? [] : {};

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];

                if (typeof value === 'object' && value !== null) {
                    sanitized[key] = this.sanitizeObject(value);
                } else if (typeof value === 'string') {
                    sanitized[key] = this.sanitizeString(value);
                } else {
                    sanitized[key] = value;
                }
            }
        }

        return sanitized;
    }

    private sanitizeString(str: string): string {
        if (!str) return str;

        // 1. Trim whitespace
        let sanitized = str.trim();

        // 2. Comprehensive XSS Prevention
        // - Remove <script> tags and their content
        sanitized = sanitized.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '');

        // - Remove <iframe>, <object>, <embed>, <applet>, <base>, <form> tags
        sanitized = sanitized.replace(/<(iframe|object|embed|applet|base|form)\b[^>]*>([\s\S]*?)<\/\1>/gim, '');

        // - Remove inline event handlers (onmouseover, onclick, etc.)
        sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gim, '');
        sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gim, '');

        // - Remove dangerous link protocols
        sanitized = sanitized.replace(/href\s*=\s*["']\s*(javascript|data|vbscript):[^"']*["']/gim, 'href="#"');

        // - Remove potential CSS expression/javascript injection
        sanitized = sanitized.replace(/expression\s*\(/gim, 'x-expression(');

        // 3. Prevent Shell commands if strings are used in exec (extra safety)
        // sanitized = sanitized.replace(/[;&|`$]/g, ''); // Too aggressive for normal text

        return sanitized;
    }
}

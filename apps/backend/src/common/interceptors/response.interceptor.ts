import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiResponse } from '@affexai/shared-types';

/**
 * Response Interceptor
 * 
 * Wraps all successful responses in a standardized ApiResponse format.
 * This ensures consistent response structure across all API endpoints.
 * 
 * Response Format:
 * ```json
 * {
 *   "success": true,
 *   "data": { ... },
 *   "meta": {
 *     "timestamp": "2025-10-09T10:30:00Z"
 *   }
 * }
 * ```
 * 
 * @example
 * // Apply globally in main.ts
 * app.useGlobalInterceptors(new ResponseInterceptor());
 * 
 * @example
 * // Apply to specific controller
 * @UseInterceptors(ResponseInterceptor)
 * @Controller('events')
 * export class EventsController { }
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the response is already wrapped (has success property), return as is
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiResponse<T>;
        }

        // Wrap the response
        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}

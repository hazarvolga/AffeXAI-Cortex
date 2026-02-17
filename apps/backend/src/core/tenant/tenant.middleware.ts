import { Injectable, NestMiddleware, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    private readonly logger = new Logger(TenantMiddleware.name);

    constructor(private readonly tenantService: TenantService) { }

    use(req: Request, res: Response, next: NextFunction) {
        // 1. Try Header
        let tenantId = req.headers['x-tenant-id'] as string;

        // 2. Try JWT (Unverified extraction for early context)
        if (!tenantId && req.headers.authorization?.startsWith('Bearer ')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const base64Payload = token.split('.')[1];
                const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
                tenantId = payload.tenantId;
            } catch (e) {
                // Ignore decoding errors, context will remain empty or default
            }
        }

        // 3. Try Path (Detect /[tenant]/admin or /[tenant]/portal)
        if (!tenantId) {
            const pathSegments = req.path.split('/');
            // Pattern: slugs are usually the first segment after the leading slash
            const potentialSlug = pathSegments[1];
            // List of reserved top-level prefixes that are NOT tenant slugs
            const reservedWords = ['auth', 'api', 'admin', 'portal', 'static', 'uploads', 'media', 'brand'];

            if (potentialSlug && !reservedWords.includes(potentialSlug) && potentialSlug.length > 2) {
                tenantId = potentialSlug;
            }
        }

        // 4. Fallback to default for dev/public if still not found
        const context = {
            tenantId: tenantId || 'default',
        };

        // Run the rest of the request within the CLS context
        this.tenantService.runWithTenant(context, async () => {
            // Note: Setting DB session variable here is tricky because TypeORM 
            // uses a connection pool. The real RLS enforcement happens in the
            // data layer by explicitly adding tenantId to queries, 
            // with the RLS policy as a final kernel-level safeguard.

            this.logger.log(`[TENANT-CONTEXT] Established for: ${context.tenantId}`);
            next();
        });
    }
}

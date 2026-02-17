import { Module, Global, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantMiddleware } from './tenant.middleware';

@Global()
@Module({
    providers: [TenantService],
    exports: [TenantService],
})
export class TenantModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(TenantMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}

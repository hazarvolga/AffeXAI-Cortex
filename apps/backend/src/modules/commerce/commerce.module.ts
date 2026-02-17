import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommerceController } from './controllers/commerce.controller';
import { CommerceService } from './services/commerce.service';
import { Product } from './entities/product.entity';
import { Price } from './entities/price.entity';
import { Subscription } from './entities/subscription.entity';
import { UsageRecord } from './entities/usage-record.entity';
import { StripeProvider } from './services/stripe.provider';
import { PaymentWebhookController } from './controllers/payment.webhook.controller';
import { AdminProductController } from './controllers/admin-product.controller';
import { ProductManagementService } from './services/product-management.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Product, Price, Subscription, UsageRecord]),
    ],
    controllers: [CommerceController, PaymentWebhookController, AdminProductController],
    providers: [CommerceService, StripeProvider, ProductManagementService],
    exports: [CommerceService, StripeProvider, ProductManagementService],
})
export class CommerceModule { }

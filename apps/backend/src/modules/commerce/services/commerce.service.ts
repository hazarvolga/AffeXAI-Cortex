import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Price } from '../entities/price.entity';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import { UsageRecord } from '../entities/usage-record.entity';
import { StripeProvider } from './stripe.provider';

@Injectable()
export class CommerceService {
    constructor(
        @InjectRepository(Product)
        private productRepo: Repository<Product>,
        @InjectRepository(Price)
        private priceRepo: Repository<Price>,
        @InjectRepository(Subscription)
        private subscriptionRepo: Repository<Subscription>,
        @InjectRepository(UsageRecord)
        private usageRepo: Repository<UsageRecord>,
        private stripeProvider: StripeProvider,
    ) { }

    // --- Product Catalog ---
    async getProducts() {
        return this.productRepo.find({
            relations: ['prices'],
            where: { active: true }
        });
    }

    async createProduct(data: Partial<Product>) {
        const product = this.productRepo.create(data);
        return this.productRepo.save(product);
    }

    // --- Subscriptions ---
    async getSubscription(tenantId: string) {
        return this.subscriptionRepo.findOne({
            where: { tenantId, status: SubscriptionStatus.ACTIVE },
            relations: ['price', 'price.product'],
            order: { createdAt: 'DESC' }
        });
    }

    async createCheckoutSession(tenantId: string, priceId: string, userEmail?: string) {
        const price = await this.priceRepo.findOne({ where: { id: priceId } });
        if (!price) throw new NotFoundException('Price not found');

        // TODO: Get frontend URL from config
        const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/commerce/success`;
        const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/commerce/cancel`;

        const session = await this.stripeProvider.createCheckoutSession(
            price.stripePriceId, // Assuming Price entity has this, if not we need to map or use priceId if it IS the stripe id
            tenantId,
            successUrl,
            cancelUrl,
            userEmail
        );
        return session;
    }

    async handleCheckoutSuccess(session: any) {
        const tenantId = session.client_reference_id || session.metadata?.tenantId;
        const stripeSubscriptionId = session.subscription as string;
        const stripeCustomerId = session.customer as string;

        if (!tenantId) {
            console.error('Webhook received without tenantId');
            return;
        }

        // Fetch subscription details from Stripe to get strict dates
        const stripe = this.stripeProvider.getClient();
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        // Cancel existing active subscriptions locally
        await this.subscriptionRepo.update(
            { tenantId, status: SubscriptionStatus.ACTIVE },
            { status: SubscriptionStatus.CANCELED, updatedAt: new Date() }
        );

        // Find the local Price entity matching the Stripe Price ID
        // For MVP, we might need to store stripePriceId in our Price entity
        // Or assume we can find it. 
        // Let's assume the first item's price ID corresponds to our local Price.stripePriceId
        const item = stripeSub.items.data[0];
        const localPrice = await this.priceRepo.findOne({ where: { stripePriceId: item.price.id } });

        if (!localPrice) {
            console.warn(`Local price not found for Stripe Price ID: ${item.price.id}. Subscription might be desynced.`);
        }

        const newSub = this.subscriptionRepo.create({
            tenantId,
            stripeSubscriptionId,
            stripeCustomerId,
            price: localPrice, // Nullable if not found, but ideally mapped
            priceId: localPrice?.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date((stripeSub as any).current_period_start * 1000),
            currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
            cancelAtPeriodEnd: (stripeSub as any).cancel_at_period_end
        });

        await this.subscriptionRepo.save(newSub);
        console.log(`[Commerce] Provisioned subscription for tenant ${tenantId}`);
    }

    async assignPlan(tenantId: string, priceId: string) {
        // ... (Legacy implementation kept for Admin/Seed usage)
        const price = await this.priceRepo.findOne({ where: { id: priceId }, relations: ['product'] });
        if (!price) throw new NotFoundException('Price not found');

        // Cancel existing active subscriptions
        await this.subscriptionRepo.update(
            { tenantId, status: SubscriptionStatus.ACTIVE },
            { status: SubscriptionStatus.CANCELED, updatedAt: new Date() }
        );

        const sub = this.subscriptionRepo.create({
            tenantId,
            price,
            priceId: price.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            // Default 30 days for internal ledger
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        return this.subscriptionRepo.save(sub);
    }

    // --- Governance / Rate Limiting ---
    async getUsageStats(tenantId: string) {
        const check = await this.checkLimit(tenantId);
        const sub = await this.getSubscription(tenantId);

        // Calculate used from reversed check logic or just subtraction
        const used = check.limit - check.remaining;

        return {
            used,
            limit: check.limit,
            remaining: check.remaining,
            periodEnd: sub?.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };
    }

    async checkLimit(tenantId: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
        if (!tenantId) {
            console.warn('[CommerceService] checkLimit called without tenantId');
            return { allowed: true, remaining: 50000, limit: 50000 };
        }
        const sub = await this.getSubscription(tenantId);

        // Default limits if no subscription (Early Access / Fallback)
        let limit = 50000; // Starter/Default
        if (sub && sub.price.product.metadata?.ai_tokens) {
            limit = sub.price.product.metadata.ai_tokens;
        }

        // Strict Billing Cycle: Use subscription period start, or fallback to 30 days rolling
        let periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (sub && sub.currentPeriodStart) {
            periodStart = sub.currentPeriodStart;
        }

        try {
            const usage = await this.usageRepo.createQueryBuilder('usage')
                .where('usage.tenantId = :tenantId', { tenantId })
                .andWhere('usage.timestamp >= :date', { date: periodStart })
                .select('SUM(usage.tokensUsed)', 'total')
                .getRawOne();

            const used = parseInt(usage?.total || '0', 10);

            return {
                allowed: used < limit,
                remaining: Math.max(0, limit - used),
                limit
            };
        } catch (error) {
            console.error(`[CommerceService] Critical error checking limits for tenant ${tenantId}:`, error);
            // Fallback to allow operation during DB failure
            return {
                allowed: true,
                remaining: limit,
                limit
            };
        }
    }

    async logUsage(tenantId: string, tokens: number, action: string, serviceName: string) {
        // Fire and forget logging
        const record = this.usageRepo.create({
            tenantId,
            tokensUsed: tokens,
            action,
            serviceName
        });
        await this.usageRepo.save(record);
    }
}

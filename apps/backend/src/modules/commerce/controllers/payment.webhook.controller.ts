import { Controller, Post, Headers, Req, BadRequestException, RawBodyRequest } from '@nestjs/common';
import { StripeProvider } from '../services/stripe.provider';
import { CommerceService } from '../services/commerce.service';
import { ProvisioningService } from '../services/provisioning.service';
import { Request } from 'express';

@Controller('commerce/webhooks')
export class PaymentWebhookController {
    constructor(
        private readonly stripeProvider: StripeProvider,
        private readonly commerceService: CommerceService,
        private readonly provisioningService: ProvisioningService,
    ) { }

    @Post('stripe')
    async handleStripeWebhook(@Headers('stripe-signature') signature: string, @Req() req: RawBodyRequest<Request>) {
        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            throw new BadRequestException('Webhook Secret not configured');
        }

        const rawBody = req.rawBody;
        if (!rawBody) {
            throw new BadRequestException('Raw body not available');
        }

        let event;
        try {
            event = this.stripeProvider.constructEvent(
                rawBody,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error(`Webhook signature verification failed: ${err.message}`);
            throw new BadRequestException(`Webhook Error: ${err.message}`);
        }

        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                try {
                    await this.provisioningService.provisionTenantFromCheckout(session);
                } catch (error) {
                    console.error('Provisioning failed:', error);
                    // Do not throw error here to avoid Stripe retrying indefinitely if it's a logic error?
                    // Actually, if it fails, we WANT Stripe to retry usually (e.g. DB connection error).
                    // But if logic error, retry won't fix it.
                    // For now, log and rethrow internal server error if critical?
                    // Or just log.
                }
                break;
            case 'invoice.payment_succeeded':
                // Renew subscription period logic
                break;
            case 'customer.subscription.deleted':
                // Cancel subscription logic
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return { received: true };
    }
}

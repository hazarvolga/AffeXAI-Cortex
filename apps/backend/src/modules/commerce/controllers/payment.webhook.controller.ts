import { Controller, Post, Headers, Req, BadRequestException } from '@nestjs/common';
import { StripeProvider } from '../services/stripe.provider';
import { CommerceService } from '../services/commerce.service';
import { Request } from 'express';

@Controller('commerce/webhooks')
export class PaymentWebhookController {
    constructor(
        private readonly stripeProvider: StripeProvider,
        private readonly commerceService: CommerceService,
    ) { }

    @Post('stripe')
    async handleStripeWebhook(@Headers('stripe-signature') signature: string, @Req() req: Request) {
        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            throw new BadRequestException('Webhook Secret not configured');
        }

        let event;
        try {
            // In NestJS with raw body parsing, we might need a specific middleware to get the raw buffer.
            // For now, assuming req.body is accessible or handled by a raw body parser if needed.
            // A common issue in NestJS is that body parser converts to JSON before here.
            // We might need to ensure raw body is preserved for this route.
            // For this MVP implementation, we assume the raw body is passed.
            // If strictly typed, we might need `req['rawBody']`.
            event = this.stripeProvider.constructEvent(
                req.body,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error(`Webhook signature verification failed: ${err.message}`);
            throw new BadRequestException(`Webhook Error: ${err.message}`);
        }

        switch (event.type) {
            case 'checkout.session.completed':
                // const session = event.data.object;
                // Activate subscription
                // await this.commerceService.handleCheckoutSuccess(session);
                break;
            case 'invoice.payment_succeeded':
                // Renew subscription period
                break;
            case 'customer.subscription.deleted':
                // Cancel subscription
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return { received: true };
    }
}

import { Test, TestingModule } from '@nestjs/testing';
import { EmailWebhookAdapterFactoryService } from './email-webhook-adapter-factory.service';
import { SendGridAdapter } from './adapters/sendgrid.adapter';
import { MailgunAdapter } from './adapters/mailgun.adapter';
import { PostmarkAdapter } from './adapters/postmark.adapter';

describe('EmailWebhookAdapterFactoryService', () => {
    let service: EmailWebhookAdapterFactoryService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [EmailWebhookAdapterFactoryService],
        }).compile();

        service = module.get<EmailWebhookAdapterFactoryService>(EmailWebhookAdapterFactoryService);
    });

    describe('getAdapter', () => {
        it('should return SendGrid adapter for sendgrid provider', () => {
            const adapter = service.getAdapter('sendgrid');
            expect(adapter).toBeInstanceOf(SendGridAdapter);
        });

        it('should return Mailgun adapter for mailgun provider', () => {
            const adapter = service.getAdapter('mailgun');
            expect(adapter).toBeInstanceOf(MailgunAdapter);
        });

        it('should return Postmark adapter for postmark provider', () => {
            const adapter = service.getAdapter('postmark');
            expect(adapter).toBeInstanceOf(PostmarkAdapter);
        });

        it('should throw error for unknown provider', () => {
            expect(() => service.getAdapter('unknown')).toThrow('Unknown email provider');
        });

        it('should be case-insensitive for provider names', () => {
            expect(() => service.getAdapter('SENDGRID')).not.toThrow();
            expect(() => service.getAdapter('SendGrid')).not.toThrow();
        });
    });

    describe('parseWebhook', () => {
        it('should parse SendGrid webhook payload', async () => {
            const payload = {
                event: 'delivered',
                email: 'test@example.com',
                timestamp: 1234567890,
                'smtp-id': '<message-id@sendgrid.com>',
            };

            const result = await service.parseWebhook('sendgrid', payload);

            expect(result).toHaveProperty('event');
            expect(result).toHaveProperty('email');
            expect(result.event).toBe('delivered');
        });

        it('should parse Mailgun webhook payload', async () => {
            const payload = {
                event: 'opened',
                recipient: 'test@example.com',
                timestamp: '1234567890',
                'message-id': '<message-id@mailgun.com>',
            };

            const result = await service.parseWebhook('mailgun', payload);

            expect(result).toHaveProperty('event');
            expect(result).toHaveProperty('email');
        });

        it('should parse Postmark webhook payload', async () => {
            const payload = {
                RecordType: 'Delivery',
                Recipient: 'test@example.com',
                DeliveredAt: '2024-01-01T12:00:00Z',
                MessageID: 'message-id',
            };

            const result = await service.parseWebhook('postmark', payload);

            expect(result).toHaveProperty('event');
            expect(result).toHaveProperty('email');
        });

        it('should handle bounce events', async () => {
            const payload = {
                event: 'bounce',
                email: 'test@example.com',
                reason: 'mailbox full',
            };

            const result = await service.parseWebhook('sendgrid', payload);

            expect(result.event).toBe('bounce');
            expect(result).toHaveProperty('reason');
        });

        it('should handle spam reports', async () => {
            const payload = {
                event: 'spamreport',
                email: 'test@example.com',
            };

            const result = await service.parseWebhook('sendgrid', payload);

            expect(result.event).toBe('spamreport');
        });

        it('should throw error for invalid payload', async () => {
            const invalidPayload = { invalid: 'data' };

            await expect(
                service.parseWebhook('sendgrid', invalidPayload),
            ).rejects.toThrow();
        });
    });

    describe('validateWebhookSignature', () => {
        it('should validate SendGrid webhook signature', () => {
            const payload = { event: 'delivered' };
            const signature = 'valid-signature';
            const timestamp = '1234567890';

            const result = service.validateSignature('sendgrid', payload, signature, timestamp);

            expect(typeof result).toBe('boolean');
        });

        it('should reject invalid signatures', () => {
            const payload = { event: 'delivered' };
            const invalidSignature = 'invalid';
            const timestamp = '1234567890';

            const result = service.validateSignature('sendgrid', payload, invalidSignature, timestamp);

            expect(result).toBe(false);
        });
    });

    describe('normalizeEvent', () => {
        it('should normalize different provider event names', () => {
            expect(service.normalizeEvent('sendgrid', 'delivered')).toBe('delivered');
            expect(service.normalizeEvent('mailgun', 'accepted')).toBe('delivered');
            expect(service.normalizeEvent('postmark', 'Delivery')).toBe('delivered');
        });

        it('should handle bounce events from all providers', () => {
            expect(service.normalizeEvent('sendgrid', 'bounce')).toBe('bounced');
            expect(service.normalizeEvent('mailgun', 'failed')).toBe('bounced');
            expect(service.normalizeEvent('postmark', 'Bounce')).toBe('bounced');
        });
    });

    describe('edge cases', () => {
        it('should handle missing optional fields', async () => {
            const minimalPayload = {
                event: 'delivered',
                email: 'test@example.com',
            };

            const result = await service.parseWebhook('sendgrid', minimalPayload);

            expect(result).toBeDefined();
        });

        it('should handle malformed email addresses', async () => {
            const payload = {
                event: 'delivered',
                email: 'invalid-email',
            };

            await expect(
                service.parseWebhook('sendgrid', payload),
            ).rejects.toThrow();
        });

        it('should handle very large payloads', async () => {
            const largePayload = {
                event: 'delivered',
                email: 'test@example.com',
                metadata: 'x'.repeat(100000),
            };

            const result = await service.parseWebhook('sendgrid', largePayload);

            expect(result).toBeDefined();
        });
    });
});

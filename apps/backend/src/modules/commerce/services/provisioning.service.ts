
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import Stripe from 'stripe';

import { Organization } from '../../organizations/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import { Price } from '../entities/price.entity';
import { MailService } from '../../mail/mail.service';
import { SettingsService } from '../../settings/settings.service';

import { StripeProvider } from './stripe.provider';

@Injectable()
export class ProvisioningService {
    private readonly logger = new Logger(ProvisioningService.name);

    constructor(
        private dataSource: DataSource,
        @InjectRepository(Organization)
        private orgRepo: Repository<Organization>,
        @InjectRepository(User)
        private userRepo: Repository<User>,
        @InjectRepository(Role)
        private roleRepo: Repository<Role>,
        @InjectRepository(Subscription)
        private subRepo: Repository<Subscription>,
        @InjectRepository(Price)
        private priceRepo: Repository<Price>,
        @Inject(forwardRef(() => MailService))
        private mailService: MailService,
        @Inject(forwardRef(() => SettingsService))
        private settingsService: SettingsService,
        private configService: ConfigService,
        private stripeProvider: StripeProvider,
    ) { }

    async provisionTenantFromCheckout(session: Stripe.Checkout.Session) {
        const { customer_details, subscription: subscriptionId, customer: customerId } = session;
        const email = customer_details?.email;
        const name = customer_details?.name || email?.split('@')[0] || 'Customer';

        if (!email || !subscriptionId) {
            this.logger.error('Missing email or subscription ID in checkout session');
            return;
        }

        this.logger.log(`Starting provisioning for ${email} (Sub: ${subscriptionId})`);

        // Fetch Subscription from Stripe to get Price ID?
        // Or do we have it in session? session.line_items usually.
        // For now, assume we can get priceId later or pass it.
        // A better way is to handle 'customer.subscription.created' webhook, but checkout.session.completed is safer for initial provisioning.

        // We need to resolve the local Price ID from the Stripe Price ID in the session.
        // This might require an extra API call to Stripe or looking up via metadata.
        // Simplification: We will lookup the Price by querying our local DB using the price ID from line items (if expanded)
        // or just fetch the subscription from Stripe API here if needed.
        // For MVP, we'll try to find the price via the subscription object if passed, or just proceed with tenant creation.
        // The subscription creation in DB might need the price ID.

        let passwordGenerated = '';
        let isNewUser = false;

        await this.dataSource.transaction(async (manager) => {
            // 1. Check if Tenant exists by Email (using a convention or lookup)
            // Ideally we check if a User exists with this email.
            const existingUser = await manager.findOne(User, { where: { email } });
            let tenantId = existingUser?.tenantId;
            let user = existingUser;

            if (!tenantId) {
                // Create Organization (Tenant)
                const orgName = `${name}'s Workspace`;
                const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);

                const org = manager.create(Organization, {
                    name: orgName,
                    slug: slug,
                    isActive: true,
                    settings: {}
                });
                const savedOrg = await manager.save(org);
                tenantId = savedOrg.id;
                this.logger.log(`Created Tenant: ${tenantId}`);

                // Create Admin User
                if (!user) {
                    isNewUser = true;
                    passwordGenerated = Math.random().toString(36).slice(-10) + 'A1!'; // Simple random password
                    const salt = await bcrypt.genSalt();
                    const hashedPassword = await bcrypt.hash(passwordGenerated, salt);

                    // Find Admin Role (or Owner)
                    // We need to find the role specifically for this tenant? No, roles are tenant-scoped usually?
                    // "roles" table usually has tenantId. If we just created the tenant, we might need to seed roles for it?
                    // Or use a global default role?
                    // checking Role entity... it likely has tenantId.
                    // If roles are not seeded for new tenant, we assume standard roles exist or global roles.
                    // Let's assume we copy default roles or use a system role.
                    // For now, let's try to find a 'owner' or 'admin' role in the system.
                    // If the system isolates roles per tenant, we MUST insert roles first.
                    // Let's assume for MVP we assign a generic 'admin' role if available, or just create one.

                    // HACK: Use the first available 'admin' role or create one.
                    // Better: Seed defaults.
                    let adminRole = await manager.findOne(Role, { where: { name: 'admin', tenantId } });
                    if (!adminRole) {
                        // Create default admin role for this tenant
                        adminRole = manager.create(Role, {
                            name: 'admin',
                            description: 'Administrator',
                            tenantId: tenantId,
                            permissions: ['*'], // Full access
                            isSystem: true
                        });
                        await manager.save(adminRole);
                    }

                    user = manager.create(User, {
                        email,
                        password: hashedPassword,
                        firstName: name.split(' ')[0],
                        lastName: name.split(' ')[1] || '',
                        isActive: true,
                        organizationId: tenantId,
                        tenantId: tenantId,
                        roleId: adminRole.id,
                        emailVerified: true // Auto-verify for paid users?
                    });
                    await manager.save(user);
                    this.logger.log(`Created User: ${user.id}`);
                }
            }

            // 2. Create Subscription Record
            if (subscriptionId) {
                // Fetch Stripe Subscription to get Price
                const stripe = this.stripeProvider.getClient();
                const stripeSub = await stripe.subscriptions.retrieve(subscriptionId as string);
                const priceItem = stripeSub.items.data[0];

                if (priceItem) {
                    const price = await manager.findOne(Price, { where: { stripePriceId: priceItem.price.id }, relations: ['product'] });

                    if (price) {
                        const sub = manager.create(Subscription, {
                            tenantId,
                            stripeSubscriptionId: subscriptionId as string,
                            stripeCustomerId: customerId as string,
                            priceId: price.id,
                            status: SubscriptionStatus.ACTIVE,
                            currentPeriodStart: new Date((stripeSub as any).current_period_start * 1000),
                            currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
                            cancelAtPeriodEnd: (stripeSub as any).cancel_at_period_end
                        });
                        await manager.save(sub);
                        this.logger.log(`Created Subscription: ${sub.id}`);

                        // Branding Logic
                        if (price.product?.metadata?.show_branding !== undefined) {
                            try {
                                // We are inside transaction, but SettingsService uses its own repo/managers.
                                // It should be fine as long as we don't lock same rows.
                                // Or we can queue this update.
                                // For now, await it.
                                await (this.settingsService as any).updateOrCreateSetting(
                                    'company',
                                    'showPoweredBy',
                                    String(price.product.metadata.show_branding),
                                    tenantId
                                );
                            } catch (e) {
                                this.logger.warn(`Failed to set branding: ${e.message}`);
                            }
                        }
                    } else {
                        this.logger.warn(`Price not found for Stripe Price ID: ${priceItem.price.id}`);
                    }
                }
            }
        });

        // 3. Send Email (outside transaction)
        if (isNewUser && passwordGenerated) {
            try {
                await this.mailService.sendAccountCreated(email, {
                    name,
                    password: passwordGenerated,
                    loginUrl: `${this.configService.get('FRONTEND_URL')}/auth/login`,
                    workspaceName: `${name}'s Workspace`
                });
                this.logger.log(`Sent welcome email to ${email}`);
            } catch (e) {
                this.logger.error(`Failed to send welcome email: ${e.message}`);
            }
        }
    }

    // Helper to be called by Controller with full data
    async provisionWithPrice(session: Stripe.Checkout.Session, stripePriceId: string) {
        // ... logic above but using stripePriceId to find local price ...
        // Refactored logic:
        const { customer_details, subscription: subscriptionId, customer: customerId } = session;
        const email = customer_details?.email;
        const name = customer_details?.name || email?.split('@')[0] || 'Customer';

        if (!email || !subscriptionId) return;

        let passwordGenerated = '';
        let isNewUser = false;

        await this.dataSource.transaction(async (manager) => {
            // Find Price
            const price = await manager.findOne(Price, { where: { stripePriceId } });
            if (!price) throw new Error(`Price not found for stripe id: ${stripePriceId}`);

            // Idempotency: Check if subscription already exists
            const existingSub = await manager.findOne(Subscription, { where: { stripeSubscriptionId: subscriptionId as string } });
            if (existingSub) {
                this.logger.warn(`Subscription ${subscriptionId} already exists. Skipping.`);
                return;
            }

            // User/Tenant Logic
            let user = await manager.findOne(User, { where: { email } });
            let tenantId = user?.tenantId;

            if (!tenantId) {
                // Create Tenant
                const orgName = `${name}'s Workspace`;
                const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 10000);
                const org = manager.create(Organization, { name: orgName, slug, isActive: true, settings: {} });
                const savedOrg = await manager.save(org);
                tenantId = savedOrg.id;

                // Create Admin Role
                const adminRole = manager.create(Role, {
                    name: 'admin',
                    description: 'Administrator',
                    tenantId,
                    permissions: ['*'],
                    isSystem: true
                });
                await manager.save(adminRole);

                // Create User
                isNewUser = true;
                passwordGenerated = Math.random().toString(36).slice(-10) + 'A1!';
                const salt = await bcrypt.genSalt();
                const hashedPassword = await bcrypt.hash(passwordGenerated, salt);

                user = manager.create(User, {
                    email,
                    password: hashedPassword,
                    firstName: name.split(' ')[0],
                    lastName: name.split(' ')[1] || '',
                    isActive: true,
                    organizationId: tenantId,
                    tenantId: tenantId,
                    roleId: adminRole.id,
                    emailVerified: true
                });
                await manager.save(user);
            }

            // Create Subscription
            const sub = manager.create(Subscription, {
                tenantId,
                stripeSubscriptionId: subscriptionId as string,
                stripeCustomerId: customerId as string,
                priceId: price.id,
                status: SubscriptionStatus.ACTIVE,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Approx, webhook update attempts fix this
            });
            await manager.save(sub);
        });

        if (isNewUser && passwordGenerated) {
            await this.mailService.sendAccountCreated(email, {
                name,
                password: passwordGenerated,
                loginUrl: `${this.configService.get('FRONTEND_URL')}/auth/login`,
                workspaceName: `${name}'s Workspace`
            });
        }
    }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscriber } from '../entities/subscriber.entity';
import { MailService } from '../../mail/mail.service';
import { MailChannel, MailPriority } from '../../mail/interfaces/mail-service.interface';
import { TenantService } from '../../../core/tenant/tenant.service';
import { SubscriberStatus } from '@affexai/shared-types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OptInOutService {
  constructor(
    @InjectRepository(Subscriber)
    private readonly subscriberRepository: Repository<Subscriber>,
    private readonly mailService: MailService,
    private readonly tenantService: TenantService,
  ) { }

  /**
   * Get current tenant ID from TenantService
   * @private
   */
  private getTenantId(): string {
    return this.tenantService.getTenantId() || 'default';
  }

  /**
   * Subscribe a new email with double opt-in
   */
  async subscribeWithDoubleOptIn(
    email: string,
    data?: {
      firstName?: string;
      lastName?: string;
      company?: string;
      marketingEmails?: boolean;
    },
    ipAddress?: string,
  ): Promise<{ message: string; requiresConfirmation: boolean }> {
    // Check if already subscribed
    const tenantId = this.getTenantId();
    let subscriber = await this.subscriberRepository.findOne({
      where: { email, tenantId },
    });

    if (subscriber) {
      if (subscriber.status === SubscriberStatus.ACTIVE) {
        return {
          message: 'Bu email adresi zaten kayıtlı.',
          requiresConfirmation: false,
        };
      }

      if (subscriber.status === SubscriberStatus.PENDING && !subscriber.isDoubleOptIn) {
        // Resend confirmation email
        await this.sendOptInConfirmationEmail(subscriber);
        return {
          message: 'Onay emaili tekrar gönderildi. Lütfen email kutunuzu kontrol edin.',
          requiresConfirmation: true,
        };
      }
    }

    // Create new subscriber
    const optInToken = uuidv4();
    const unsubscribeToken = uuidv4();

    subscriber = this.subscriberRepository.create({
      email,
      firstName: data?.firstName,
      lastName: data?.lastName,
      company: data?.company,
      status: SubscriberStatus.PENDING,
      isDoubleOptIn: false,
      optInToken,
      unsubscribeToken,
      optInIp: ipAddress,
      emailNotifications: true,
      marketingEmails: data?.marketingEmails !== false,
      transactionalEmails: true,
      tenantId,
    });

    await this.subscriberRepository.save(subscriber);

    // Send confirmation email
    await this.sendOptInConfirmationEmail(subscriber);

    return {
      message: 'Aboneliğinizi onaylamak için email adresinize gönderilen linke tıklayın.',
      requiresConfirmation: true,
    };
  }

  /**
   * Confirm double opt-in subscription
   */
  async confirmOptIn(token: string, ipAddress?: string): Promise<{ success: boolean; message: string }> {
    const tenantId = this.getTenantId();
    const subscriber = await this.subscriberRepository.findOne({
      where: { optInToken: token, tenantId },
    });

    if (!subscriber) {
      throw new NotFoundException('Geçersiz veya süresi dolmuş onay linki.');
    }

    if (subscriber.isDoubleOptIn) {
      return {
        success: true,
        message: 'Aboneliğiniz zaten onaylanmış.',
      };
    }

    // Update subscriber
    subscriber.isDoubleOptIn = true;
    subscriber.status = SubscriberStatus.ACTIVE;
    subscriber.optInDate = new Date();
    subscriber.optInIp = ipAddress || subscriber.optInIp;
    subscriber.optInToken = null as any; // Clear token after use

    await this.subscriberRepository.save(subscriber);

    // Send welcome email
    await this.sendWelcomeEmail(subscriber);

    return {
      success: true,
      message: 'Aboneliğiniz başarıyla onaylandı! Hoş geldiniz.',
    };
  }

  /**
   * Unsubscribe using token (one-click unsubscribe)
   */
  async unsubscribeWithToken(
    token: string,
    reason?: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string }> {
    const tenantId = this.getTenantId();
    const subscriber = await this.subscriberRepository.findOne({
      where: { unsubscribeToken: token, tenantId },
    });

    if (!subscriber) {
      throw new NotFoundException('Geçersiz abonelikten çıkma linki.');
    }

    if (subscriber.status === SubscriberStatus.UNSUBSCRIBED) {
      return {
        success: true,
        message: 'Zaten abonelikten çıkmışsınız.',
      };
    }

    // Update subscriber
    subscriber.status = SubscriberStatus.UNSUBSCRIBED;
    subscriber.optOutDate = new Date();
    subscriber.optOutReason = reason || '';
    subscriber.optOutIp = ipAddress || '';
    subscriber.emailNotifications = false;
    subscriber.marketingEmails = false;
    // Keep transactional emails as true (legal/important emails)

    await this.subscriberRepository.save(subscriber);

    // Send goodbye email
    await this.sendGoodbyeEmail(subscriber);

    return {
      success: true,
      message: 'Abonelikten başarıyla çıktınız. Tekrar görüşmek üzere!',
    };
  }

  /**
   * Update email preferences
   */
  async updatePreferences(
    email: string,
    preferences: {
      marketingEmails?: boolean;
      emailNotifications?: boolean;
    },
  ): Promise<Subscriber> {
    const tenantId = this.getTenantId();
    const subscriber = await this.subscriberRepository.findOne({
      where: { email, tenantId },
    });

    if (!subscriber) {
      throw new NotFoundException('Abone bulunamadı.');
    }

    if (preferences.marketingEmails !== undefined) {
      subscriber.marketingEmails = preferences.marketingEmails;
    }

    if (preferences.emailNotifications !== undefined) {
      subscriber.emailNotifications = preferences.emailNotifications;
    }

    return await this.subscriberRepository.save(subscriber);
  }

  /**
   * Re-subscribe (opt back in)
   */
  async resubscribe(
    email: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string }> {
    const tenantId = this.getTenantId();
    const subscriber = await this.subscriberRepository.findOne({
      where: { email, tenantId },
    });

    if (!subscriber) {
      throw new NotFoundException('Bu email adresi sistemde kayıtlı değil.');
    }

    if (subscriber.status === SubscriberStatus.ACTIVE) {
      return {
        success: true,
        message: 'Zaten aktif abonesiniz.',
      };
    }

    // Generate new opt-in token for re-confirmation
    subscriber.optInToken = uuidv4();
    subscriber.status = SubscriberStatus.PENDING;
    subscriber.isDoubleOptIn = false;
    subscriber.optOutDate = null as any;
    subscriber.optOutReason = null as any;

    await this.subscriberRepository.save(subscriber);

    // Send re-confirmation email
    await this.sendOptInConfirmationEmail(subscriber);

    return {
      success: true,
      message: 'Yeniden abone olmak için email adresinize gönderilen linke tıklayın.',
    };
  }

  /**
   * Get subscriber preferences
   */
  async getPreferences(email: string): Promise<{
    emailNotifications: boolean;
    marketingEmails: boolean;
    transactionalEmails: boolean;
    status: string;
  }> {
    const tenantId = this.getTenantId();
    const subscriber = await this.subscriberRepository.findOne({
      where: { email, tenantId },
    });

    if (!subscriber) {
      throw new NotFoundException('Abone bulunamadı.');
    }

    return {
      emailNotifications: subscriber.emailNotifications,
      marketingEmails: subscriber.marketingEmails,
      transactionalEmails: subscriber.transactionalEmails,
      status: subscriber.status as string,
    };
  }

  /**
   * Send opt-in confirmation email
   */
  private async sendOptInConfirmationEmail(subscriber: Subscriber): Promise<void> {
    const confirmationUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/confirm-subscription?token=${subscriber.optInToken}`;

    await this.mailService.sendMail({
      to: { email: subscriber.email },
      subject: 'Aboneliğinizi Onaylayın',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Aboneliğinizi Onaylayın</h2>
              <p>Merhaba ${subscriber.firstName || 'Değerli Abone'},</p>
              <p>Aluplan haber bültenimize abone olmak için lütfen aşağıdaki butona tıklayın. Bu bağlantı tek kullanımlıktır.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Aboneliği Onayla
                </a>
              </div>
              <p>Veya bu linki tarayıcınıza kopyalayın:</p>
              <p style="word-break: break-all; color: #666;">${confirmationUrl}</p>
              <p>Eğer bu talebi siz yapmadıysanız, bu e-postayı güvenle görmezden gelebilirsiniz.</p>
              <p>Teşekkürler,<br/>Aluplan Ekibi</p>
            </div>
          </body>
        </html>
      `,
      text: `Merhaba ${subscriber.firstName || 'Değerli Abone'},

Aluplan haber bültenimize abone olmak için lütfen aşağıdaki linke tıklayın:
${confirmationUrl}

Teşekkürler,
Aluplan Ekibi`,
      channel: MailChannel.MARKETING,
      priority: MailPriority.NORMAL,
    }, subscriber.tenantId);
  }

  /**
   * Send welcome email
   */
  private async sendWelcomeEmail(subscriber: Subscriber): Promise<void> {
    const preferencesUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/email-preferences?email=${subscriber.email}`;

    await this.mailService.sendMail({
      to: { email: subscriber.email },
      subject: 'Hoş Geldiniz!',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Hoş Geldiniz!</h2>
              <p>Merhaba ${subscriber.firstName || 'Değerli Abone'},</p>
              <p>Aluplan haber bültenimize abone olduğunuz için teşekkür ederiz! Artık en yeni haberler ve kampanyalardan ilk siz haberdar olacaksınız.</p>
              <p>E-posta tercihlerinizi dilediğiniz zaman <a href="${preferencesUrl}">buradan</a> değiştirebilirsiniz.</p>
              <p>Teşekkürler,<br/>Aluplan Ekibi</p>
            </div>
          </body>
        </html>
      `,
      text: `Merhaba ${subscriber.firstName || 'Değerli Abone'},

Aluplan haber bültenimize abone olduğunuz için teşekkür ederiz! Artık en yeni haberler ve kampanyalardan ilk siz haberdar olacaksınız.

E-posta tercihlerinizi dilediğiniz zaman buradan değiştirebilirsiniz: ${preferencesUrl}

Teşekkürler,
Aluplan Ekibi`,
      channel: MailChannel.MARKETING,
      priority: MailPriority.NORMAL,
    }, subscriber.tenantId);
  }

  /**
   * Send goodbye email
   */
  private async sendGoodbyeEmail(subscriber: Subscriber): Promise<void> {
    const resubscribeUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/resubscribe?email=${subscriber.email}`;

    await this.mailService.sendMail({
      to: { email: subscriber.email },
      subject: 'Görüşmek Üzere',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Görüşmek Üzere</h2>
              <p>Merhaba ${subscriber.firstName || 'Değerli Abone'},</p>
              <p>Aluplan haber bülteninden ayrıldığınız için üzgünüz. Artık size pazarlama e-postaları göndermeyeceğiz.</p>
              <p>Fikrinizi değiştirirseniz, dilediğiniz zaman <a href="${resubscribeUrl}">buraya tıklayarak</a> yeniden abone olabilirsiniz.</p>
              <p>Teşekkürler,<br/>Aluplan Ekibi</p>
            </div>
          </body>
        </html>
      `,
      text: `Merhaba ${subscriber.firstName || 'Değerli Abone'},

Aluplan haber bülteninden ayrıldığınız için üzgünüz. Artık size pazarlama e-postaları göndermeyeceğiz.

Fikrinizi değiştirirseniz, dilediğiniz zaman yeniden abone olabilirsiniz: ${resubscribeUrl}

Teşekkürler,
Aluplan Ekibi`,
      channel: MailChannel.MARKETING,
      priority: MailPriority.NORMAL,
    }, subscriber.tenantId);
  }

  /**
   * Check if email can receive marketing emails
   */
  async canReceiveMarketingEmails(email: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    const subscriber = await this.subscriberRepository.findOne({
      where: { email, tenantId },
    });

    if (!subscriber) {
      return false;
    }

    return (
      subscriber.status === SubscriberStatus.ACTIVE &&
      subscriber.isDoubleOptIn &&
      subscriber.marketingEmails &&
      subscriber.emailNotifications
    );
  }

  /**
   * Check if email can receive transactional emails
   */
  async canReceiveTransactionalEmails(email: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    const subscriber = await this.subscriberRepository.findOne({
      where: { email, tenantId },
    });

    // Transactional emails can always be sent (legal requirement)
    return subscriber?.transactionalEmails !== false;
  }
}
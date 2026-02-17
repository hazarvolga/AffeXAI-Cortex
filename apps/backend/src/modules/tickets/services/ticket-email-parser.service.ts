import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketsService } from '../tickets.service';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TenantService } from '../../../core/tenant/tenant.service';

/**
 * Email Parser Service
 * Parses inbound emails and creates/updates tickets
 */

export interface ParsedEmail {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  inReplyTo?: string; // For threading
  references?: string[]; // For threading
  messageId: string;
  receivedAt: Date;
  attachments?: ParsedAttachment[];
}

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  size: number;
}

@Injectable()
export class TicketEmailParserService {
  private readonly logger = new Logger(TicketEmailParserService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepository: Repository<TicketMessage>,
    private readonly ticketsService: TicketsService,
    private readonly tenantService: TenantService,
  ) { }

  /**
   * Parse and process inbound email
   */
  async processInboundEmail(email: ParsedEmail): Promise<Ticket> {
    try {
      this.logger.log(`Processing inbound email from: ${email.from}`);

      // Find or get user ID from email - in real implementation would look up user by email
      // For now, using a placeholder that would need to be implemented
      const userId = 'system-email-user'; // NOTE: User lookup by email planned - uses system user for now

      // Check if this is a reply to existing ticket
      const existingTicket = await this.findTicketByEmail(email);

      if (existingTicket) {
        // Add message to existing ticket
        return await this.addMessageToTicket(existingTicket, email);
      } else {
        // Create new ticket - tenant context from TenantService
        return await this.createTicketFromEmail(email, userId);
      }
    } catch (error) {
      this.logger.error(`Failed to process email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find ticket by email threading headers or subject
   */
  private async findTicketByEmail(email: ParsedEmail): Promise<Ticket | null> {
    // Method 1: Check In-Reply-To header
    if (email.inReplyTo) {
      const ticket = await this.findTicketByMessageId(email.inReplyTo);
      if (ticket) return ticket;
    }

    // Method 2: Check References header
    if (email.references && email.references.length > 0) {
      for (const ref of email.references) {
        const ticket = await this.findTicketByMessageId(ref);
        if (ticket) return ticket;
      }
    }

    // Method 3: Parse ticket ID from subject line
    const ticketId = this.extractTicketIdFromSubject(email.subject);
    if (ticketId) {
      const ticket = await this.ticketRepository.findOne({
        where: { id: ticketId },
        relations: ['customer', 'assignedAgent', 'category'],
      });
      if (ticket) return ticket;
    }

    return null;
  }

  /**
   * Find ticket by message ID stored in metadata
   */
  private async findTicketByMessageId(messageId: string): Promise<Ticket | null> {
    const message = await this.messageRepository.findOne({
      where: { emailMessageId: messageId },
      relations: ['ticket'],
    });

    return message?.ticket || null;
  }

  /**
   * Extract ticket ID from subject line
   * Supports formats: [#TICKET-123], Ticket #123, Re: #123, etc.
   */
  private extractTicketIdFromSubject(subject: string): string | null {
    const patterns = [
      /#([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i, // UUID
      /\[#([^\]]+)\]/i, // [#ID]
      /ticket[:\s]+#?([^\s,]+)/i, // Ticket: #ID
      /#(\d+)/i, // #ID
    ];

    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Create new ticket from email
   */
  private async createTicketFromEmail(email: ParsedEmail, userId: string): Promise<Ticket> {
    this.logger.log(`Creating new ticket from email: ${email.subject}`);

    // Extract or determine customer (simplified - would need user lookup)
    const customerEmail = email.from;

    // Determine priority from subject/content
    const priority = this.detectPriority(email.subject, email.textBody);

    // Create ticket
    const ticket = await this.ticketsService.create(userId, {
      subject: this.cleanSubject(email.subject),
      description: this.extractDescription(email),
      priority,
      categoryId: null as any, // Would need to auto-categorize
      tags: this.extractTags(email.subject, email.textBody),
      customFields: {
        source: 'email',
        originalFrom: email.from,
        originalSubject: email.subject,
        receivedAt: email.receivedAt.toISOString(),
      },
    });

    // Store email message ID for threading
    await this.messageRepository.update(
      { ticketId: ticket.id },
      { emailMessageId: email.messageId },
    );

    this.logger.log(`Created ticket ${ticket.id} from email`);
    return ticket;
  }

  /**
   * Add message to existing ticket
   */
  private async addMessageToTicket(
    ticket: Ticket,
    email: ParsedEmail,
  ): Promise<Ticket> {
    this.logger.log(`Adding message to ticket ${ticket.id}`);

    // Add message
    const message = this.messageRepository.create({
      ticketId: ticket.id,
      content: this.extractDescription(email),
      isInternal: false,
      authorId: ticket.userId, // Customer sent this
      emailMessageId: email.messageId,
    });

    await this.messageRepository.save(message);

    // Update ticket status if it was closed
    if (ticket.status === TicketStatus.CLOSED) {
      ticket.status = TicketStatus.OPEN;
      ticket.responseTimeHours = 0; // Reset metrics
      await this.ticketRepository.save(ticket);
    }

    this.logger.log(`Added message to ticket ${ticket.id}`);
    return ticket;
  }

  /**
   * Detect priority from email content
   */
  private detectPriority(subject: string, body: string): TicketPriority {
    const urgentKeywords = [
      'urgent',
      'critical',
      'emergency',
      'asap',
      'immediately',
      'acil',
      'kritik',
      'acele',
    ];
    const highKeywords = [
      'important',
      'high priority',
      'önemli',
      'yüksek öncelik',
    ];

    const text = `${subject} ${body}`.toLowerCase();

    for (const keyword of urgentKeywords) {
      if (text.includes(keyword)) {
        return TicketPriority.URGENT;
      }
    }

    for (const keyword of highKeywords) {
      if (text.includes(keyword)) {
        return TicketPriority.HIGH;
      }
    }

    return TicketPriority.MEDIUM;
  }

  /**
   * Clean email subject (remove Re:, Fwd:, etc.)
   */
  private cleanSubject(subject: string): string {
    return subject
      .replace(/^(re|fwd|fw|ynt|ilet):\s*/gi, '')
      .replace(/\[#[^\]]+\]/gi, '')
      .trim();
  }

  /**
   * Extract description from email
   */
  private extractDescription(email: ParsedEmail): string {
    // Use HTML if available, otherwise text
    let content = email.htmlBody || email.textBody;

    // Remove email signatures
    content = this.removeEmailSignature(content);

    // Remove quoted replies
    content = this.removeQuotedReplies(content);

    return content.trim();
  }

  /**
   * Remove email signature
   */
  private removeEmailSignature(content: string): string {
    const signaturePatterns = [
      /--\s*$/m,
      /^--\s*\n/m,
      /\n--\s*\n/m,
      /Sent from my/i,
      /Best regards/i,
      /Saygılarımla/i,
    ];

    for (const pattern of signaturePatterns) {
      const match = content.match(pattern);
      if (match) {
        content = content.substring(0, match.index);
      }
    }

    return content;
  }

  /**
   * Remove quoted replies (> lines)
   */
  private removeQuotedReplies(content: string): string {
    const lines = content.split('\n');
    const filteredLines = lines.filter((line) => !line.trim().startsWith('>'));
    return filteredLines.join('\n');
  }

  /**
   * Extract tags from subject/body
   */
  private extractTags(subject: string, body: string): string[] {
    const tags: string[] = [];
    const text = `${subject} ${body}`.toLowerCase();

    // Common support topics
    const tagPatterns = [
      { pattern: /billing|payment|invoice|fatura|ödeme/i, tag: 'billing' },
      { pattern: /bug|error|hata|sorun/i, tag: 'bug' },
      { pattern: /feature|request|özellik|istek/i, tag: 'feature-request' },
      { pattern: /question|soru/i, tag: 'question' },
      { pattern: /login|password|şifre|giriş/i, tag: 'authentication' },
    ];

    for (const { pattern, tag } of tagPatterns) {
      if (pattern.test(text)) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

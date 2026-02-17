import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ProcessedUrl {
  text: string;
  title: string;
  metadata: {
    url: string;
    wordCount: number;
    characterCount: number;
    scrapedAt: Date;
    statusCode: number;
    contentType?: string;
    description?: string;
    author?: string;
    publishedDate?: string;
  };
}

@Injectable()
export class UrlProcessingService {
  private readonly logger = new Logger(UrlProcessingService.name);

  private readonly TIMEOUT = 30000; // 30 seconds
  private readonly MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 5MB
  private readonly USER_AGENT = 'Mozilla/5.0 (compatible; AffexAI-Bot/1.0; +https://affexai.com/bot)';

  /**
   * Scrape and extract content from URL
   */
  async processUrl(url: string): Promise<ProcessedUrl> {
    this.logger.log(`Processing URL: ${url}`);

    // Validate URL
    this.validateUrl(url);

    try {
      // Fetch URL content
      const response = await axios.get(url, {
        timeout: this.TIMEOUT,
        maxContentLength: this.MAX_CONTENT_LENGTH,
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new BadRequestException('URL does not return HTML content');
      }

      // Parse HTML
      const $ = cheerio.load(response.data);

      // Extract metadata
      const title = this.extractTitle($);
      const description = this.extractDescription($);
      const author = this.extractAuthor($);
      const publishedDate = this.extractPublishedDate($);

      // Extract main content
      const extractedText = this.extractMainContent($);

      // Clean text
      const cleanedText = this.cleanText(extractedText);

      return {
        text: cleanedText,
        title,
        metadata: {
          url,
          wordCount: this.countWords(cleanedText),
          characterCount: cleanedText.length,
          scrapedAt: new Date(),
          statusCode: response.status,
          contentType,
          description,
          author,
          publishedDate,
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new BadRequestException('Request timeout - URL took too long to respond');
        }
        if (error.response) {
          throw new BadRequestException(`Failed to fetch URL: HTTP ${error.response.status}`);
        }
        throw new BadRequestException(`Failed to fetch URL: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Extract title from HTML
   */
  private extractTitle($: cheerio.CheerioAPI): string {
    // Try Open Graph title
    let title = $('meta[property="og:title"]').attr('content');

    // Try Twitter title
    if (!title) {
      title = $('meta[name="twitter:title"]').attr('content');
    }

    // Try standard title tag
    if (!title) {
      title = $('title').text();
    }

    // Try h1 as fallback
    if (!title) {
      title = $('h1').first().text();
    }

    return title?.trim() || 'Untitled';
  }

  /**
   * Extract meta description
   */
  private extractDescription($: cheerio.CheerioAPI): string | undefined {
    let description = $('meta[property="og:description"]').attr('content');

    if (!description) {
      description = $('meta[name="description"]').attr('content');
    }

    if (!description) {
      description = $('meta[name="twitter:description"]').attr('content');
    }

    return description?.trim();
  }

  /**
   * Extract author information
   */
  private extractAuthor($: cheerio.CheerioAPI): string | undefined {
    let author = $('meta[name="author"]').attr('content');

    if (!author) {
      author = $('meta[property="article:author"]').attr('content');
    }

    return author?.trim();
  }

  /**
   * Extract published date
   */
  private extractPublishedDate($: cheerio.CheerioAPI): string | undefined {
    let date = $('meta[property="article:published_time"]').attr('content');

    if (!date) {
      date = $('meta[name="publish-date"]').attr('content');
    }

    if (!date) {
      date = $('time[datetime]').first().attr('datetime');
    }

    return date?.trim();
  }

  /**
   * Extract main content from HTML
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, iframe, noscript').remove();
    $('[role="navigation"], [role="banner"], [role="complementary"]').remove();
    $('.advertisement, .ads, .sidebar, .cookie-notice').remove();

    // Try to find main content area
    let content = '';

    // Try semantic HTML5 tags
    const main = $('main, article, [role="main"]').first();
    if (main.length) {
      content = main.text();
    } else {
      // Fallback to body
      content = $('body').text();
    }

    return content;
  }

  /**
   * Clean extracted text
   */
  private cleanText(text: string): string {
    return text
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Remove multiple line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace
      .trim();
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): void {
    try {
      const urlObj = new URL(url);

      // Only allow HTTP and HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new BadRequestException('Only HTTP and HTTPS URLs are allowed');
      }

      // Block localhost and private IPs
      const hostname = urlObj.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      ) {
        throw new BadRequestException('Local and private network URLs are not allowed');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid URL format');
    }
  }

  /**
   * Check if URL is accessible
   */
  async checkUrl(url: string): Promise<{ accessible: boolean; statusCode?: number; error?: string }> {
    try {
      this.validateUrl(url);

      const response = await axios.head(url, {
        timeout: 10000,
        headers: {
          'User-Agent': this.USER_AGENT,
        },
        validateStatus: () => true, // Don't throw on any status
      });

      return {
        accessible: response.status >= 200 && response.status < 400,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        accessible: false,
        error: error.message,
      };
    }
  }
}

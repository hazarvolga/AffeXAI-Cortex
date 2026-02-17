import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as puppeteer from 'puppeteer';
import robotsParser from 'robots-parser';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import { ChatUrlCache, UrlProcessingStatus } from '../entities/chat-url-cache.entity';
import { UrlValidator } from '../utils/url-validator.util';
import { TenantService } from '../../../core/tenant/tenant.service';

export interface UrlProcessingResult {
  success: boolean;
  cached: boolean;
  data?: {
    title: string;
    content: string;
    metadata: any;
  };
  error?: string;
}

@Injectable()
export class UrlProcessorService {
  private readonly logger = new Logger(UrlProcessorService.name);
  private browser: puppeteer.Browser | null = null;
  private readonly rateLimitMap = new Map<string, number>();
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests per domain
  private readonly CACHE_EXPIRY_HOURS = 24;
  private readonly MAX_CONTENT_LENGTH = 50000;

  constructor(
    @InjectRepository(ChatUrlCache)
    private readonly urlCacheRepository: Repository<ChatUrlCache>,
    private readonly tenantService: TenantService,
  ) { }

  async onModuleInit() {
    // Initialize browser instance
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      this.logger.log('Puppeteer browser initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Puppeteer browser', error);
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.logger.log('Puppeteer browser closed');
    }
  }

  /**
   * Process a URL and extract content with caching
   */
  async processUrl(url: string): Promise<UrlProcessingResult> {
    try {
      // Validate URL
      const validation = UrlValidator.validate(url);
      if (!validation.isValid) {
        return { success: false, cached: false, error: validation.error };
      }

      // Use normalized URL for processing
      url = validation.normalizedUrl!;

      const urlHash = this.generateUrlHash(url);

      // Check cache first
      const cached = await this.getCachedUrl(urlHash);
      if (cached && !cached.isExpired && cached.isProcessed) {
        this.logger.debug(`Cache hit for URL: ${url}`);
        return {
          success: true,
          cached: true,
          data: {
            title: cached.title || '',
            content: cached.content || '',
            metadata: cached.metadata,
          },
        };
      }

      // Check robots.txt compliance
      const robotsAllowed = await this.checkRobotsCompliance(url);
      if (!robotsAllowed) {
        return { success: false, cached: false, error: 'Robots.txt disallows crawling' };
      }

      // Apply rate limiting
      await this.applyRateLimit(url);

      // Create or update cache entry with pending status
      let cacheEntry = cached || new ChatUrlCache();
      cacheEntry.urlHash = urlHash;
      cacheEntry.originalUrl = url;
      cacheEntry.processingStatus = UrlProcessingStatus.PROCESSING;
      cacheEntry.expiresAt = new Date(Date.now() + this.CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
      cacheEntry.metadata = { ...cacheEntry.metadata, robotsAllowed };
      cacheEntry.tenantId = this.tenantService.getTenantId();

      await this.urlCacheRepository.save(cacheEntry);

      // Extract content
      const extractionResult = await this.extractContent(url);

      // Update cache with results
      cacheEntry.title = extractionResult.title;
      cacheEntry.content = extractionResult.content;
      cacheEntry.metadata = {
        ...cacheEntry.metadata,
        ...extractionResult.metadata,
        extractionMethod: extractionResult.method,
      };
      cacheEntry.processingStatus = extractionResult.success
        ? UrlProcessingStatus.COMPLETED
        : UrlProcessingStatus.FAILED;

      if (!extractionResult.success) {
        cacheEntry.metadata.processingError = extractionResult.error;
      }

      await this.urlCacheRepository.save(cacheEntry);

      if (extractionResult.success) {
        return {
          success: true,
          cached: false,
          data: {
            title: cacheEntry.title || '',
            content: cacheEntry.content || '',
            metadata: cacheEntry.metadata,
          },
        };
      } else {
        return { success: false, cached: false, error: extractionResult.error };
      }

    } catch (error) {
      this.logger.error(`Error processing URL ${url}:`, error);
      return { success: false, cached: false, error: error.message };
    }
  }

  /**
   * Extract content from URL using multiple methods
   */
  private async extractContent(url: string): Promise<{
    success: boolean;
    title?: string;
    content?: string;
    metadata?: any;
    method?: string;
    error?: string;
  }> {
    // Try Puppeteer first for dynamic content
    if (this.browser) {
      try {
        const puppeteerResult = await this.extractWithPuppeteer(url);
        if (puppeteerResult.success) {
          return { ...puppeteerResult, method: 'puppeteer' };
        }
      } catch (error) {
        this.logger.warn(`Puppeteer extraction failed for ${url}:`, error.message);
      }
    }

    // Fallback to simple HTTP request with Cheerio
    try {
      const cheerioResult = await this.extractWithCheerio(url);
      return { ...cheerioResult, method: 'cheerio' };
    } catch (error) {
      this.logger.error(`All extraction methods failed for ${url}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract content using Puppeteer for dynamic content
   */
  private async extractWithPuppeteer(url: string): Promise<{
    success: boolean;
    title?: string;
    content?: string;
    metadata?: any;
    error?: string;
  }> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();

    try {
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (compatible; AI-Support-Bot/1.0)');
      await page.setViewport({ width: 1280, height: 720 });

      // Navigate with timeout
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      if (!response || !response.ok()) {
        throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
      }

      // Extract content
      const result = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, nav, header, footer, aside');
        scripts.forEach(el => el.remove());

        // Get title
        const title = document.title ||
          document.querySelector('h1')?.textContent ||
          document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';

        // Get main content
        const contentSelectors = [
          'main', 'article', '[role="main"]', '.content', '.post-content',
          '.entry-content', '.article-content', '.page-content'
        ];

        let content = '';
        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            content = element.textContent || '';
            break;
          }
        }

        // Fallback to body if no main content found
        if (!content) {
          content = document.body?.textContent || '';
        }

        // Clean up content
        content = content.replace(/\s+/g, ' ').trim();

        // Extract metadata
        const getMetaContent = (name: string) =>
          document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.getAttribute('content') || '';

        return {
          title: title.trim(),
          content,
          metadata: {
            description: getMetaContent('description') || getMetaContent('og:description'),
            author: getMetaContent('author'),
            publishedDate: getMetaContent('article:published_time') || getMetaContent('datePublished'),
            imageUrl: getMetaContent('og:image'),
            siteName: getMetaContent('og:site_name'),
            contentType: getMetaContent('og:type'),
            wordCount: content.split(' ').length,
            statusCode: response?.status(),
          }
        };
      });

      // Limit content length
      if (result.content.length > this.MAX_CONTENT_LENGTH) {
        result.content = result.content.substring(0, this.MAX_CONTENT_LENGTH) + '...';
      }

      return { success: true, ...result };

    } finally {
      await page.close();
    }
  }

  /**
   * Extract content using Cheerio for static content
   */
  private async extractWithCheerio(url: string): Promise<{
    success: boolean;
    title?: string;
    content?: string;
    metadata?: any;
    error?: string;
  }> {

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Support-Bot/1.0)',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside').remove();

    // Extract title
    const title = $('title').text() ||
      $('h1').first().text() ||
      $('meta[property="og:title"]').attr('content') || '';

    // Extract main content
    const contentSelectors = [
      'main', 'article', '[role="main"]', '.content', '.post-content',
      '.entry-content', '.article-content', '.page-content'
    ];

    let content = '';
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length) {
        content = element.text();
        break;
      }
    }

    // Fallback to body
    if (!content) {
      content = $('body').text();
    }

    // Clean up content
    content = content.replace(/\s+/g, ' ').trim();

    // Limit content length
    if (content.length > this.MAX_CONTENT_LENGTH) {
      content = content.substring(0, this.MAX_CONTENT_LENGTH) + '...';
    }

    // Extract metadata
    const getMetaContent = (name: string) =>
      $(`meta[name="${name}"], meta[property="${name}"]`).attr('content') || '';

    const metadata = {
      description: getMetaContent('description') || getMetaContent('og:description'),
      author: getMetaContent('author'),
      publishedDate: getMetaContent('article:published_time') || getMetaContent('datePublished'),
      imageUrl: getMetaContent('og:image'),
      siteName: getMetaContent('og:site_name'),
      contentType: getMetaContent('og:type'),
      wordCount: content.split(' ').length,
      statusCode: response.status,
    };

    return {
      success: true,
      title: title.trim(),
      content,
      metadata,
    };
  }

  /**
   * Check robots.txt compliance
   */
  private async checkRobotsCompliance(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;

      const response = await fetch(robotsUrl, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        // If robots.txt doesn't exist, assume crawling is allowed
        return true;
      }

      const robotsTxt = await response.text();
      const robots = robotsParser(robotsUrl, robotsTxt);

      return robots.isAllowed(url, 'AI-Support-Bot') !== false;
    } catch (error) {
      this.logger.warn(`Could not check robots.txt for ${url}:`, error.message);
      // If we can't check robots.txt, assume it's allowed
      return true;
    }
  }

  /**
   * Apply rate limiting per domain
   */
  private async applyRateLimit(url: string): Promise<void> {
    try {
      const domain = new URL(url).hostname;
      const lastRequest = this.rateLimitMap.get(domain) || 0;
      const timeSinceLastRequest = Date.now() - lastRequest;

      if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
        const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      this.rateLimitMap.set(domain, Date.now());
    } catch (error) {
      // If URL parsing fails, skip rate limiting
      this.logger.warn(`Could not apply rate limiting for ${url}:`, error.message);
    }
  }

  /**
   * Get cached URL entry
   */
  private async getCachedUrl(urlHash: string): Promise<ChatUrlCache | null> {
    return await this.urlCacheRepository.findOne({
      where: {
        urlHash,
        tenantId: this.tenantService.getTenantId()
      }
    });
  }

  /**
   * Generate hash for URL
   */
  private generateUrlHash(url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex');
  }



  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache(): Promise<number> {
    const result = await this.urlCacheRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .andWhere('tenantId = :tenantId', { tenantId: this.tenantService.getTenantId() })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} expired cache entries`);
    return result.affected || 0;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    expired: number;
  }> {
    const [total, completed, failed, pending, expired] = await Promise.all([
      this.urlCacheRepository.count({ where: { tenantId: this.tenantService.getTenantId() } }),
      this.urlCacheRepository.count({ where: { processingStatus: UrlProcessingStatus.COMPLETED, tenantId: this.tenantService.getTenantId() } }),
      this.urlCacheRepository.count({ where: { processingStatus: UrlProcessingStatus.FAILED, tenantId: this.tenantService.getTenantId() } }),
      this.urlCacheRepository.count({ where: { processingStatus: UrlProcessingStatus.PENDING, tenantId: this.tenantService.getTenantId() } }),
      this.urlCacheRepository
        .createQueryBuilder()
        .where('expiresAt < :now', { now: new Date() })
        .andWhere('tenantId = :tenantId', { tenantId: this.tenantService.getTenantId() })
        .getCount(),
    ]);

    return { total, completed, failed, pending, expired };
  }
}
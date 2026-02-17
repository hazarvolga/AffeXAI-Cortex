import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { UrlProcessorService } from '../services/url-processor.service';
import { UrlCacheService } from '../services/url-cache.service';
import { UrlProcessingStatus } from '../entities/chat-url-cache.entity';

class ProcessUrlDto {
  url: string;
  forceRefresh?: boolean;
}

class BulkProcessUrlsDto {
  urls: string[];
  forceRefresh?: boolean;
}

@Controller('chat/urls')
@UseGuards(JwtAuthGuard)
export class UrlProcessingController {
  constructor(
    private readonly urlProcessorService: UrlProcessorService,
    private readonly urlCacheService: UrlCacheService,
  ) {}

  /**
   * Process a single URL and extract content
   */
  @Post('process')
  async processUrl(@Body() dto: ProcessUrlDto) {
    try {
      // If force refresh, remove from cache first
      if (dto.forceRefresh) {
        await this.urlCacheService.removeCacheByUrl(dto.url);
      }

      const result = await this.urlProcessorService.processUrl(dto.url);
      
      if (!result.success) {
        throw new HttpException(
          { message: 'URL processing failed', error: result.error },
          HttpStatus.BAD_REQUEST
        );
      }

      return {
        success: true,
        cached: result.cached,
        data: result.data,
      };
    } catch (error) {
      throw new HttpException(
        { message: 'URL processing failed', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Process multiple URLs in batch
   */
  @Post('process/batch')
  async processBatchUrls(@Body() dto: BulkProcessUrlsDto) {
    const results = [];
    const errors = [];

    for (const url of dto.urls) {
      try {
        // If force refresh, remove from cache first
        if (dto.forceRefresh) {
          await this.urlCacheService.removeCacheByUrl(url);
        }

        const result = await this.urlProcessorService.processUrl(url);
        results.push({
          url,
          success: result.success,
          cached: result.cached,
          data: result.data,
          error: result.error,
        });
      } catch (error) {
        errors.push({
          url,
          error: error.message,
        });
      }
    }

    return {
      processed: results.length,
      errorCount: errors.length,
      results,
      errors,
    };
  }

  /**
   * Get cached URL data
   */
  @Get('cache/:urlHash')
  async getCachedUrl(@Param('urlHash') urlHash: string) {
    const cached = await this.urlCacheService.getCachedUrl(urlHash);
    
    if (!cached) {
      throw new HttpException('URL not found in cache', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      data: cached,
    };
  }

  /**
   * Get cache entries with pagination and filtering
   */
  @Get('cache')
  async getCacheEntries(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('status') status?: UrlProcessingStatus,
    @Query('domain') domain?: string,
    @Query('sortBy') sortBy: 'createdAt' | 'expiresAt' | 'title' = 'createdAt',
    @Query('sortOrder') sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const result = await this.urlCacheService.getCacheEntries({
      page: parseInt(page.toString(), 10),
      limit: Math.min(parseInt(limit.toString(), 10), 100), // Max 100 per page
      status,
      domain,
      sortBy,
      sortOrder,
    });

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Get cache metrics and statistics
   */
  @Get('cache/metrics')
  async getCacheMetrics() {
    const metrics = await this.urlCacheService.getCacheMetrics();
    
    return {
      success: true,
      metrics,
    };
  }

  /**
   * Clean up expired and failed cache entries
   */
  @Post('cache/cleanup')
  async cleanupCache(
    @Body() options?: {
      removeExpired?: boolean;
      removeFailed?: boolean;
      olderThanDays?: number;
    }
  ) {
    const result = await this.urlCacheService.cleanupCache(options);
    
    return {
      success: true,
      cleanup: result,
    };
  }

  /**
   * Remove specific URL from cache
   */
  @Delete('cache')
  async removeCacheByUrl(@Body('url') url: string) {
    const removed = await this.urlCacheService.removeCacheByUrl(url);
    
    if (!removed) {
      throw new HttpException('URL not found in cache', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      message: 'URL removed from cache',
    };
  }

  /**
   * Get cache entries for a specific domain
   */
  @Get('cache/domain/:domain')
  async getCacheByDomain(
    @Param('domain') domain: string,
    @Query('limit') limit = 50,
  ) {
    const entries = await this.urlCacheService.getCacheByDomain(
      domain,
      Math.min(parseInt(limit.toString(), 10), 100)
    );

    return {
      success: true,
      domain,
      count: entries.length,
      entries,
    };
  }

  /**
   * Preload URLs for caching
   */
  @Post('cache/preload')
  async preloadUrls(@Body('urls') urls: string[]) {
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new HttpException('URLs array is required', HttpStatus.BAD_REQUEST);
    }

    if (urls.length > 100) {
      throw new HttpException('Maximum 100 URLs allowed per batch', HttpStatus.BAD_REQUEST);
    }

    const result = await this.urlCacheService.preloadUrls(urls);
    
    return {
      success: true,
      preload: result,
    };
  }

  /**
   * Reset cache metrics
   */
  @Post('cache/metrics/reset')
  async resetCacheMetrics() {
    this.urlCacheService.resetMetrics();
    
    return {
      success: true,
      message: 'Cache metrics reset',
    };
  }

  /**
   * Bulk update cache entry status
   */
  @Post('cache/bulk-update')
  async bulkUpdateStatus(
    @Body() dto: {
      urlHashes: string[];
      status: UrlProcessingStatus;
    }
  ) {
    if (!Array.isArray(dto.urlHashes) || dto.urlHashes.length === 0) {
      throw new HttpException('URL hashes array is required', HttpStatus.BAD_REQUEST);
    }

    const updated = await this.urlCacheService.bulkUpdateStatus(
      dto.urlHashes,
      dto.status
    );

    return {
      success: true,
      updated,
      message: `${updated} entries updated`,
    };
  }
}
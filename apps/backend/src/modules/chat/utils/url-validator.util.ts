import { URL } from 'url';

export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
  normalizedUrl?: string;
  domain?: string;
  protocol?: string;
}

export class UrlValidator {
  private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:'];
  private static readonly BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
  ];
  private static readonly BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.scr', '.pif',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.mp4', '.avi', '.mkv', '.mov', '.wmv',
    '.mp3', '.wav', '.flac', '.aac',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  ];

  /**
   * Validate and normalize URL
   */
  static validate(url: string): UrlValidationResult {
    try {
      // Basic format check
      if (!url || typeof url !== 'string') {
        return { isValid: false, error: 'URL is required and must be a string' };
      }

      // Trim whitespace
      url = url.trim();

      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Parse URL
      const urlObj = new URL(url);

      // Check protocol
      if (!this.ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
        return {
          isValid: false,
          error: `Protocol ${urlObj.protocol} is not allowed. Only HTTP and HTTPS are supported.`,
        };
      }

      // Check for blocked domains
      const hostname = urlObj.hostname.toLowerCase();
      if (this.BLOCKED_DOMAINS.includes(hostname)) {
        return {
          isValid: false,
          error: `Domain ${hostname} is not allowed`,
        };
      }

      // Check for private IP ranges
      if (this.isPrivateIP(hostname)) {
        return {
          isValid: false,
          error: 'Private IP addresses are not allowed',
        };
      }

      // Check file extension
      const pathname = urlObj.pathname.toLowerCase();
      const hasBlockedExtension = this.BLOCKED_EXTENSIONS.some(ext => 
        pathname.endsWith(ext)
      );
      
      if (hasBlockedExtension) {
        return {
          isValid: false,
          error: 'File downloads are not supported',
        };
      }

      // Check URL length
      if (url.length > 2048) {
        return {
          isValid: false,
          error: 'URL is too long (maximum 2048 characters)',
        };
      }

      // Normalize URL
      const normalizedUrl = this.normalizeUrl(urlObj);

      return {
        isValid: true,
        normalizedUrl,
        domain: hostname,
        protocol: urlObj.protocol,
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Invalid URL format: ${error.message}`,
      };
    }
  }

  /**
   * Check if hostname is a private IP address
   */
  private static isPrivateIP(hostname: string): boolean {
    // IPv4 private ranges
    const ipv4Patterns = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./,              // 192.168.0.0/16
      /^169\.254\./,              // 169.254.0.0/16 (link-local)
    ];

    // IPv6 private ranges
    const ipv6Patterns = [
      /^fc00:/,                   // fc00::/7 (unique local)
      /^fe80:/,                   // fe80::/10 (link-local)
      /^::1$/,                    // ::1 (loopback)
    ];

    const allPatterns = [...ipv4Patterns, ...ipv6Patterns];
    return allPatterns.some(pattern => pattern.test(hostname));
  }

  /**
   * Normalize URL for consistent caching
   */
  private static normalizeUrl(urlObj: URL): string {
    // Remove fragment
    urlObj.hash = '';
    
    // Sort query parameters
    const params = new URLSearchParams(urlObj.search);
    const sortedParams = new URLSearchParams();
    
    // Sort parameters alphabetically
    Array.from(params.keys())
      .sort()
      .forEach(key => {
        params.getAll(key).forEach(value => {
          sortedParams.append(key, value);
        });
      });
    
    urlObj.search = sortedParams.toString() ? '?' + sortedParams.toString() : '';
    
    // Remove trailing slash from pathname (except for root)
    if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // Convert to lowercase (except for query parameters which might be case-sensitive)
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname.toLowerCase()}${urlObj.pathname}`;
    const search = urlObj.search;
    
    return baseUrl + search;
  }

  /**
   * Extract domain from URL
   */
  static extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  /**
   * Check if URL is likely to be a web page (not a file download)
   */
  static isWebPage(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // If no extension or common web extensions
      const webExtensions = ['.html', '.htm', '.php', '.asp', '.aspx', '.jsp'];
      const hasWebExtension = webExtensions.some(ext => pathname.endsWith(ext));
      const hasNoExtension = !pathname.includes('.') || pathname.endsWith('/');
      
      return hasWebExtension || hasNoExtension;
    } catch {
      return false;
    }
  }

  /**
   * Validate multiple URLs
   */
  static validateBatch(urls: string[]): Array<UrlValidationResult & { originalUrl: string }> {
    return urls.map(url => ({
      originalUrl: url,
      ...this.validate(url),
    }));
  }

  /**
   * Check if URL is safe for crawling (basic security checks)
   */
  static isSafeForCrawling(url: string): boolean {
    const validation = this.validate(url);
    if (!validation.isValid) {
      return false;
    }

    // Additional safety checks
    const urlObj = new URL(validation.normalizedUrl!);
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /file:/i,
      /ftp:/i,
    ];

    const urlString = urlObj.toString();
    return !suspiciousPatterns.some(pattern => pattern.test(urlString));
  }

  /**
   * Get URL metadata for display
   */
  static getUrlMetadata(url: string): {
    domain: string | null;
    protocol: string | null;
    path: string | null;
    isSecure: boolean;
  } {
    try {
      const urlObj = new URL(url);
      return {
        domain: urlObj.hostname,
        protocol: urlObj.protocol,
        path: urlObj.pathname,
        isSecure: urlObj.protocol === 'https:',
      };
    } catch {
      return {
        domain: null,
        protocol: null,
        path: null,
        isSecure: false,
      };
    }
  }
}
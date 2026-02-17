import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessRoute, UserRole } from '@/lib/permissions/constants';

/**
 * Middleware for authentication, authorization, and optimizations
 *
 * This middleware runs on every request and:
 * - Validates authentication for protected routes
 * - Checks role-based permissions
 * - Adds optimization headers for performance and security
 */
export function middleware(request: NextRequest) {
  // Get request path
  const path = request.nextUrl.pathname;

  // ============================================================================
  // Route Redirects
  // ============================================================================

  // Redirect old newsletter routes to email-marketing
  if (path.startsWith('/admin/newsletter')) {
    const newPath = path.replace('/admin/newsletter', '/admin/email-marketing');
    return NextResponse.redirect(new URL(newPath, request.url), 301);
  }

  // ============================================================================
  // Authentication & Authorization
  // ============================================================================

  // Check if route requires authentication
  const pathSegments = path.split('/');
  const isTenantRoute = pathSegments.length > 2 && pathSegments[1] !== 'admin' && pathSegments[1] !== 'portal' && pathSegments[1] !== 'api';

  // Normalized path for check (remove tenant prefix if present)
  const normalizedPath = isTenantRoute
    ? '/' + pathSegments.slice(2).join('/')
    : path;

  const publicAdminRoutes = ['/admin/login', '/admin/signup', '/admin/forgot-password', '/admin/unauthorized'];
  const isAdminRoute = normalizedPath.startsWith('/admin') && !publicAdminRoutes.some(route => normalizedPath.startsWith(route));
  const isPortalRoute = normalizedPath.startsWith('/portal');
  const requiresAuth = isAdminRoute || isPortalRoute;

  if (requiresAuth) {
    // Get auth token from cookies or headers
    const authToken = request.cookies.get('auth_token')?.value ||
      request.cookies.get('aluplan_access_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    // No token = redirect to login
    if (!authToken) {
      console.log('🔐 Middleware: No auth token, redirecting to login');
      const loginUrl = isAdminRoute
        ? new URL('/admin/login', request.url)
        : new URL('/login', request.url);

      // Save the attempted URL for redirect after login
      loginUrl.searchParams.set('redirect', path);
      return NextResponse.redirect(loginUrl);
    }

    // JWT token exists - user is authenticated
    // Role-based authorization is handled at the layout level
    // (portal/layout.tsx and admin/layout.tsx) where we can fetch fresh user data
    try {
      const payload = authToken.split('.')[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
      const decoded = JSON.parse(Buffer.from(padded, 'base64').toString());

      console.log(`✅ Middleware: User ${decoded.email} authenticated for ${path}`);

      // Note: Role-based access control is now handled in layouts:
      // - portal/layout.tsx: Redirects Editor/Support to /admin
      // - admin/layout.tsx: Could redirect end-users to /portal (if needed)
      // This ensures fresh role data from backend instead of stale JWT data
    } catch (error) {
      console.error('🔐 Middleware: Token decode failed:', error);
      // Invalid token = redirect to login
      const loginUrl = isAdminRoute
        ? new URL('/admin/login', request.url)
        : new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ============================================================================
  // Response Headers & Optimization
  // ============================================================================

  const response = NextResponse.next();

  // Security headers (applied to all routes)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Compression hints (modern browsers support brotli)
  response.headers.set('Accept-Encoding', 'br, gzip, deflate');

  // API routes optimization
  if (path.startsWith('/api/')) {
    // Add compression for API responses
    response.headers.set('Content-Encoding', 'gzip');

    // Cache headers for API responses
    // Use stale-while-revalidate for better UX
    response.headers.set(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=120'
    );

    // Add Vary header for proper cache behavior
    response.headers.set('Vary', 'Accept-Encoding, Accept');
  }

  // Static assets optimization
  if (
    path.startsWith('/_next/static/') ||
    path.startsWith('/static/') ||
    /\.(jpg|jpeg|png|webp|avif|gif|svg|ico|woff|woff2|ttf|otf)$/.test(path)
  ) {
    // Aggressive caching for static assets
    response.headers.set(
      'Cache-Control',
      'public, max-age=31536000, immutable'
    );
  }

  // Page routes optimization
  if (!path.startsWith('/api/') && !path.startsWith('/_next/')) {
    // Add preconnect hints for external resources
    response.headers.set('Link', [
      '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
      '<https://www.googletagmanager.com>; rel=dns-prefetch',
    ].join(', '));

    // Cache pages with revalidation
    response.headers.set(
      'Cache-Control',
      'public, max-age=0, must-revalidate, stale-while-revalidate=60'
    );
  }

  return response;
}

/**
 * Middleware configuration
 * 
 * Specify which routes should be processed by this middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

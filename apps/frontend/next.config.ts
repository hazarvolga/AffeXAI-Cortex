import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // strict mode enabled
    ignoreBuildErrors: false,
  },
  eslint: {
    // Temporarily disabled due to monorepo eslint-config-next resolution issues
    ignoreDuringBuilds: true,
  },

  // Optimize for Docker deployment
  output: 'standalone',

  // Transpile Tiptap packages from node_modules
  transpilePackages: [
    '@tiptap/core',
    '@tiptap/react',
    '@tiptap/starter-kit',
    '@tiptap/extension-mention',
    '@tiptap/suggestion',
    '@tiptap/pm',
  ],

  // Webpack configuration to handle Genkit/Handlebars issues and Tiptap sub-path exports
  webpack: (config, { isServer }) => {
    // Handle handlebars require.extensions issue
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };


    // Ignore handlebars require.extensions warnings
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/handlebars/,
        message: /require\.extensions/,
      },
    ];

    // Add alias for Tiptap sub-path exports (fixes @tiptap/pm/state resolution)
    config.resolve.alias = {
      ...config.resolve.alias,
      '@tiptap/pm/state': require.resolve('prosemirror-state'),
      '@tiptap/pm/view': require.resolve('prosemirror-view'),
      '@tiptap/pm/model': require.resolve('prosemirror-model'),
      '@tiptap/pm/transform': require.resolve('prosemirror-transform'),
    };

    // Force webpack to fully resolve all Tiptap packages
    config.resolve.extensions = [
      ...config.resolve.extensions,
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
    ];

    // External modules for server-side rendering
    if (isServer) {
      config.externals = [...(config.externals || []), 'handlebars'];
    }

    return config;
  },
  // Enable compression and optimization
  compress: true, // Enable gzip compression (default in production)
  poweredByHeader: false, // Remove X-Powered-By header for security

  // Optimize production builds
  productionBrowserSourceMaps: false, // Disable source maps in production

  // API rewrites for backend proxy
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:9006/api/:path*',
      },
    ];
  },

  // HTTP headers for optimization
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache API responses with revalidation
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=120',
          },
        ],
      },
    ];
  },
  images: {
    // Enable modern image formats
    formats: ['image/avif', 'image/webp'],

    // Image optimization settings
    minimumCacheTTL: 60, // Cache images for 60 seconds minimum

    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Image sizes for different use cases
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Allowed remote image patterns
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'aluplan.com.tr',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'aluplan.com.tr',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**.localhost',
        port: '9006',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9006',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '9006',
        pathname: '/**',
      },
      // Wildcard for any domain (supports dynamic domain from settings)
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/api/media/**',
      },
      {
        protocol: 'http',
        hostname: '**',
        pathname: '/api/media/**',
      }
    ],
  },
};

// Conditionally apply bundle analyzer only in development/analysis mode
// This prevents requiring @next/bundle-analyzer in production
let exportConfig = nextConfig;

if (process.env.ANALYZE === 'true') {
  try {
    const withBundleAnalyzer = require('@next/bundle-analyzer');
    const bundleAnalyzer = withBundleAnalyzer({
      enabled: true,
    });
    exportConfig = bundleAnalyzer(nextConfig);
  } catch (error) {
    console.warn('Bundle analyzer not available, skipping...');
  }
}

export default exportConfig;
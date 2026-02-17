import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ReactNode } from 'react';
import { ThemeProvider } from '@/components/common/theme-provider';
import { AuthProvider } from '@/lib/auth';
import { WebVitalsReporter } from '@/components/performance/web-vitals-reporter';
import { DesignTokensProvider } from '@/providers/DesignTokensProvider';
import { ReactQueryProvider } from '@/providers/react-query-provider';
import { SocketProvider } from '@/providers/SocketProvider';

// Optimize Inter font with subsetting and display swap
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: 'Aluplan Digital',
  description: 'The digital gateway to advanced AEC solutions from Aluplan.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="tr" className={`${inter.variable} !scroll-smooth`} suppressHydrationWarning>
      <body className="font-body antialiased" suppressHydrationWarning>
        <WebVitalsReporter />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DesignTokensProvider defaultContext="public" defaultMode="light">
            <ReactQueryProvider>
              <AuthProvider>
                <SocketProvider tenantId="default">
                  {children}
                  <Toaster />
                </SocketProvider>
              </AuthProvider>
            </ReactQueryProvider>
          </DesignTokensProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

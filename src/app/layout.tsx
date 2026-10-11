import React, { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import localFont from 'next/font/local';
import '../styles/fikr.css';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister';

// Self-hosted: no third-party request, works offline, no flash of unstyled text.
const bricolage = localFont({
  src: [
    { path: '../../public/fonts/bricolage-500.woff2', weight: '500' },
    { path: '../../public/fonts/bricolage-700.woff2', weight: '700' },
    { path: '../../public/fonts/bricolage-800.woff2', weight: '800' },
  ],
  display: 'swap',
  variable: '--font-bricolage',
});

const figtree = localFont({
  src: [
    { path: '../../public/fonts/figtree-400.woff2', weight: '400' },
    { path: '../../public/fonts/figtree-500.woff2', weight: '500' },
    { path: '../../public/fonts/figtree-600.woff2', weight: '600' },
  ],
  display: 'swap',
  variable: '--font-figtree',
});

const caveat = localFont({
  src: [{ path: '../../public/fonts/caveat-600.woff2', weight: '600' }],
  display: 'swap',
  variable: '--font-caveat',
});

export const metadata: Metadata = {
  title: 'Fikr',
  description: 'A personal intelligence system by Common Intelligence Labs',
  applicationName: 'Fikr',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Fikr',
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8EEDC' },
    { media: '(prefers-color-scheme: dark)', color: '#0F4D3A' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${figtree.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
            <body>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cil-theme');if(!t){var s=localStorage.getItem('fikr_app_state_v1');if(s)t=JSON.parse(s).theme;}if(!t)t='dark';var d=t==='auto'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;document.documentElement.dataset.theme=d;}catch(e){}})();`,
          }}
        />
        <AppProvider>
          {children}
          <ServiceWorkerRegister />
        </AppProvider>
      </body>
    </html>
  );
}


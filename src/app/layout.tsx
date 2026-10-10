import React, { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Nunito, Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister';

const nunito = Nunito({
  weight: ['600', '700', '800', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nunito',
});

const bricolage = Bricolage_Grotesque({
  weight: ['500', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage',
});

const figtree = Figtree({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree',
});

export const metadata: Metadata = {
  title: 'Fikr - screens',
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
  themeColor: '#131316',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${bricolage.variable} ${figtree.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;700;800&family=Figtree:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
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


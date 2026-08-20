import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Apex-Work — Ethiopia\'s freelance marketplace',
    template: '%s · Apex-Work',
  },
  description:
    "Hire vetted Ethiopian digital talent or land your next gig — AI-powered, Telebirr payments, built for Amharic speakers.",
  keywords: ['freelance Ethiopia', 'Telebirr', 'Amharic freelancers', 'Addis Ababa', 'remote work'],
  openGraph: {
    title: 'Apex-Work',
    description: "Ethiopia's most powerful freelance marketplace",
    type: 'website',
    locale: 'en_ET',
    siteName: 'Apex-Work',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apex-Work',
    description: "Ethiopia's most powerful freelance marketplace",
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Apex-Work',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

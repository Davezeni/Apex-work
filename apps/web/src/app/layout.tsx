import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Noto_Sans_Ethiopic } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { AnnouncementBanner } from '@/components/site/announcement-banner';

// Plus Jakarta Sans — Friendly/Enterprise SaaS pairing (UI/UX Pro Max): modern,
// approachable, highly legible, ideal for a B2B marketplace + admin. Noto Sans
// Ethiopic backs it up so the full Amharic UI (Ethiopic script) renders crisply,
// not as a fallback system font.
const pjs = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-pjs',
  display: 'swap',
});
const ethiopic = Noto_Sans_Ethiopic({
  subsets: ['ethiopic'],
  variable: '--font-ethiopic',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: "Apex-Work — Ethiopia's freelance marketplace",
    template: '%s · Apex-Work',
  },
  description:
    'Hire vetted Ethiopian digital talent or land your next gig — AI-powered, Telebirr payments, built for Amharic speakers.',
  keywords: ['freelance Ethiopia', 'Telebirr', 'Amharic freelancers', 'Addis Ababa', 'remote work'],
  openGraph: {
    title: 'Apex-Work',
    description: "Hire the top 3% of independent talent on Apex-Work.",
    type: 'website',
    locale: 'en_ET',
    siteName: 'Apex-Work',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apex-Work',
    description: "Hire the top 3% of independent talent on Apex-Work.",
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
    <html lang="en" className={`${pjs.variable} ${ethiopic.variable}`} suppressHydrationWarning>
      <body>
        <AnnouncementBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

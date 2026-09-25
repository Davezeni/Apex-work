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
    description: 'Hire the top 3% of independent talent on Apex-Work.',
    type: 'website',
    locale: 'en_ET',
    siteName: 'Apex-Work',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apex-Work',
    description: 'Hire the top 3% of independent talent on Apex-Work.',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Apex-Work',
  },
  icons: {
    icon: '/brand/icon-192.png',
    apple: '/brand/apple-icon.png',
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
        {/* Re-apply the user's saved accent before first paint (no flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var a=localStorage.getItem('apex-accent');if(a&&/^#[0-9a-fA-F]{6}$/.test(a)){var m=a.replace('#','');var n=parseInt(m,16);var r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,h=0,s=0;if(mx!==mn){var d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?((g-b)/d+(g<b?6:0))*60:mx===g?((b-r)/d+2)*60:((r-g)/d+4)*60;}var t=Math.round(h)+' '+Math.round(s*100)+'% '+Math.round(l*100)+'%';var lum=0.2126*(function(c){c=c/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)})(r)+0.7152*(function(c){c=c/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)})(g)+0.0722*(function(c){c=c/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)})(b);var f=lum>0.45?'256 60% 9%':'0 0% 100%';var st=document.documentElement.style;st.setProperty('--primary',t);st.setProperty('--primary-foreground',f);st.setProperty('--ring',t);}}catch(e){}",
          }}
        />
        <AnnouncementBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

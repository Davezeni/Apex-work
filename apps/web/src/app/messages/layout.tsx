import type { Viewport } from 'next';

// The chat "playground" should feel like a native messenger: pinch-zoom and
// double-tap zoom are disabled on every /messages route (thread, inbox, join).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

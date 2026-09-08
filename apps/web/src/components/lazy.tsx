'use client';

/**
 * Central place to lazy-load heavy client components via next/dynamic.
 *
 * Rationale: sheets/modals/full-screen overlays are opened by *some* users
 * on *some* pages. Bundling them into the initial route hurts LCP for
 * everyone. next/dynamic({ ssr: false }) code-splits them into their own
 * chunk that only downloads the moment the sheet actually opens.
 *
 * We keep a single re-export module so pages don't accumulate `dynamic()`
 * boilerplate — just `import { LazyWithdrawSheet } from '@/components/lazy'`.
 */
import dynamic from 'next/dynamic';

// Tiny fallback used while a sheet chunk downloads (usually <100ms on
// broadband, <300ms on 3G). Avoid layout shift by rendering nothing.
const nothing = () => null;

export const LazyWithdrawSheet = dynamic(
  () => import('./wallet/withdraw-sheet').then((m) => m.WithdrawSheet),
  { ssr: false, loading: nothing },
);

export const LazyRateReviewSheet = dynamic(
  () => import('./orders/rate-review-sheet').then((m) => m.RateReviewSheet),
  { ssr: false, loading: nothing },
);

export const LazyCustomOfferSheet = dynamic(
  () => import('./chat/custom-offer-sheet').then((m) => m.CustomOfferSheet),
  { ssr: false, loading: nothing },
);

export const LazyReportUserSheet = dynamic(
  () => import('./moderation/report-user-sheet').then((m) => m.ReportUserSheet),
  { ssr: false, loading: nothing },
);

export const LazyImageViewer = dynamic(
  () => import('./ui/image-viewer').then((m) => m.ImageViewer),
  { ssr: false, loading: nothing },
);

export const LazyOfferCard = dynamic(() => import('./chat/offer-card').then((m) => m.OfferCard), {
  ssr: false,
  loading: () => <div className="w-72 max-w-full animate-pulse rounded-2xl bg-muted p-10" />,
});

// ---- Heavy chat components: code-split so the initial thread bundle stays
// small. Each only downloads the moment the relevant picker / panel / player
// actually opens, which keeps LCP fast on the message list.

export const LazyCallPanel = dynamic(() => import('./chat/call-panel').then((m) => m.CallPanel), {
  ssr: false,
  loading: nothing,
});

export const LazyVoiceRecorder = dynamic(
  () => import('./chat/voice-recorder').then((m) => m.VoiceRecorder),
  { ssr: false, loading: nothing },
);

export const LazyAttachButton = dynamic(
  () => import('./chat/attach-button').then((m) => m.AttachButton),
  { ssr: false, loading: nothing },
);

export const LazyReactionPicker = dynamic(
  () => import('./chat/reaction-picker').then((m) => m.ReactionPicker),
  { ssr: false, loading: nothing },
);

export const LazyStickerPicker = dynamic(
  () => import('./chat/sticker-picker').then((m) => m.StickerPicker),
  { ssr: false, loading: nothing },
);

export const LazyWaveformPlayer = dynamic(
  () => import('./chat/waveform').then((m) => m.WaveformPlayer),
  { ssr: false, loading: nothing },
);

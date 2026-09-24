'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, X, Send, Loader2, Cpu } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAIChat, useAIStatus } from '@/hooks/use-ai';
import { useMe } from '@/hooks/use-me';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
/** Match a media query client-side (SSR-safe: defaults to false). */
function useIsDesktop(): boolean {
  const [is, setIs] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setIs(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return is;
}

/**
 * Floating AI Chat Assistant — appears as a small bubble bottom-right on
 * every page. Tap to open a mini chat panel with product-aware answers.
 * Hidden on routes where a global floating button would obstruct core UI
 * (chat threads, resume preview, admin, etc).
 *
 * Behaviour:
 *   - Message history is kept in localStorage so it survives navigation.
 *   - Sends full recent history (cap ~20 turns) to /v1/ai/chat.
 *   - Streams the reply in with a fake typing effect for perceived speed.
 *   - Auto-close on Escape or backdrop tap.
 */

const STORAGE_KEY = 'apex-assistant-history-v1';
const MAX_HISTORY = 20;

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  source?: 'ai' | 'fallback' | 'rate';
}

/** Seconds to hold the send button after the AI rate limit trips. */
const RATE_COOLDOWN_S = 20;

function localAssistantReply(input: string): string {
  const query = input.toLowerCase();
  if (/withdraw|payout|cash/.test(query)) {
    return 'Withdrawals are available from Wallet after your balance is eligible. Apex-Work supports Telebirr, CBE Birr, and major Ethiopian banks; the minimum withdrawal is 100 ETB.';
  }
  if (/fee|commission|charge/.test(query)) {
    return 'Apex-Work charges a 10% platform fee on completed orders. Joining and listing services are free.';
  }
  if (/verify|verification|phone|otp/.test(query)) {
    return 'Phone verification is required before messaging, ordering, posting, sending offers, and withdrawing. Open Settings → Phone to verify with OTP.';
  }
  if (/payment|chapa|telebirr|cbe/.test(query)) {
    return 'Payments use Chapa and can support Telebirr, CBE Birr, cards, and other available Ethiopian payment methods. Funds are held in escrow until delivery is accepted.';
  }
  if (/resume|cv|portfolio|template/.test(query)) {
    return 'Open Resume Studio to build your CV, use free or Pro templates, run the AI coach, tailor your CV to a job, and download PDF or DOCX files.';
  }
  if (/[\u1200-\u137f]/.test(input)) {
    return 'እርዳታ ለማግኘት የApex-Work መተግበሪያን ይጠቀሙ። ስለ ክፍያ፣ ማረጋገጫ፣ CV ወይም ፖርትፎሊዮ ይጠይቁኝ።';
  }
  return 'I can help with Apex-Work payments, escrow, verification, withdrawals, resumes, portfolios, and marketplace features. Try asking about one of those topics.';
}

export function AIAssistant() {
  const pathname = usePathname();
  const { isAuthed } = useMe();
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const chat = useAIChat();
  const aiStatus = useAIStatus(open && isAuthed);
  const listRef = useRef<HTMLDivElement>(null);
  // After a 429 the send button locks briefly so the user doesn't re-trigger
  // the limiter. Counts down from RATE_COOLDOWN_S.
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // The support bubble is always available (fallback replies work even when
  // signed out). Hide only where it would obstruct core UI: on mobile chat
  // threads (composer) and on admin/login/signup/resume-preview surfaces.
  // On desktop it stays visible on every route, including open threads.
  const hidden =
    (!isDesktop && pathname.startsWith('/messages/')) ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/resume/preview');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMsgs(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open]);

  const persist = (next: Msg[]) => {
    setMsgs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-MAX_HISTORY)));
    } catch {
      /* ignore */
    }
  };

  const send = async (requestedText?: string) => {
    const text = (requestedText ?? input).trim();
    if (!text || chat.isPending || cooldown > 0) return;
    setInput('');
    const next = [...msgs, { role: 'user' as const, content: text }].slice(-MAX_HISTORY);
    persist(next);
    try {
      // Send only role/content; drop UI-only fields.
      const payload = next.map(({ role, content }) => ({ role, content }));
      const r = await chat.mutateAsync({ messages: payload });
      if (r.source === 'fallback') void aiStatus.refetch();
      persist([...next, { role: 'assistant', content: r.text, source: r.source }]);
    } catch (e) {
      void aiStatus.refetch();
      // The server rate-limits /v1/ai/* (20/min). Tell the user honestly
      // instead of implying the model just gave a product answer.
      if (e instanceof ApiError && e.status === 429) {
        setCooldown(RATE_COOLDOWN_S);
        persist([
          ...next,
          {
            role: 'assistant',
            content: 'You are sending messages very fast. Please wait a moment, then try again.',
            source: 'rate',
          },
        ]);
        return;
      }
      // Still provide useful product help if the session, API, network, or
      // live model is unavailable. The user should never get a dead chat box.
      persist([
        ...next,
        { role: 'assistant', content: localAssistantReply(text), source: 'fallback' },
      ]);
    }
  };

  const clear = () => {
    persist([]);
  };

  if (hidden) return null;

  return (
    <>
      {/* Floating trigger — a DISTINCT emerald support chip, clearly separate
          from the violet Create "+" so the two never get confused. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={dt('AI assistant')}
        className={cn(
          'safe-bottom fixed bottom-24 right-4 z-40 flex h-14 items-center gap-2 rounded-full px-4 text-sm font-bold text-primary-foreground shadow-xl shadow-primary/40 ring-1 ring-primary/30 transition-all hover:scale-105 hover:brightness-110 active:scale-95 md:bottom-8',
          'bg-primary',
          open && 'rotate-45',
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" strokeWidth={2.4} />}
        {!open && <span className="hidden sm:inline">{dt('Help')}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
            />
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="safe-bottom fixed inset-x-3 bottom-40 z-40 mx-auto flex max-h-[70dvh] max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl sm:left-auto sm:right-4 sm:w-96"
            >
              <header className="grad-hero flex items-center gap-2 p-3 text-white">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/20 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-extrabold">{dt('Apex Assistant')}</div>
                  <div className="text-[10px] opacity-80">
                    {aiStatus.data?.providerReachable === true
                      ? dt('Your 24/7 career copilot — ask me anything')
                      : dt('Smart help for hiring, gigs & money — always on')}
                  </div>
                </div>
                {msgs.length > 0 && (
                  <button
                    onClick={clear}
                    className="text-[10px] font-bold uppercase tracking-wider opacity-80 active:opacity-100"
                  >
                    Clear
                  </button>
                )}
              </header>

              <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {msgs.length === 0 && (
                  <div className="mt-4 space-y-3 text-center">
                    <div className="text-xs text-muted-foreground">Try:</div>
                    {[
                      'How do withdrawals work?',
                      'What is the platform fee?',
                      'How do I get verified?',
                      'What skills should I add to my profile?',
                      'ክፍያ እንዴት እወስዳለሁ?',
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          void send(s);
                        }}
                        className="mx-auto block w-full max-w-xs rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-primary/40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div
                    key={i}
                    className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-snug',
                        m.role === 'user'
                          ? 'grad-hero rounded-br-md text-white'
                          : 'rounded-bl-md bg-muted text-foreground',
                      )}
                    >
                      {m.content}
                      {m.role === 'assistant' && m.source === 'fallback' && (
                        <div className="mt-1 text-[10px] opacity-70">
                          {dt('Apex fallback reply')}
                        </div>
                      )}
                      {m.role === 'assistant' && m.source === 'rate' && (
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-500">
                          Slow down — try again in a few seconds
                        </div>
                      )}
                      {m.role === 'assistant' && m.source === 'ai' && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] opacity-70">
                          <Cpu className="h-2.5 w-2.5" /> AI
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chat.isPending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                      <span className="inline-flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-primary"
                          style={{ animationDelay: '.15s' }}
                        />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-primary"
                          style={{ animationDelay: '.3s' }}
                        />
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border p-2">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={1}
                    placeholder={dt('Ask me anything…')}
                    className="max-h-24 flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                  />
                  <button
                    onClick={() => void send()}
                    disabled={!input.trim() || chat.isPending || cooldown > 0}
                    aria-label={cooldown > 0 ? `Try again in ${cooldown}s` : 'Send'}
                    className="grad-hero grid h-9 w-9 shrink-0 place-items-center rounded-full text-white active:scale-90 disabled:opacity-40"
                  >
                    {chat.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : cooldown > 0 ? (
                      <span className="text-[11px] font-bold tabular-nums">{cooldown}</span>
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

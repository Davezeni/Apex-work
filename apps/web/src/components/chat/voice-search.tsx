'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
/**
 * Voice search input. Uses the browser SpeechRecognition API when
 * available (Chrome / Edge / Safari) — falls back to a mic prompt with
 * an error if the API isn't there.
 *
 * The recognizer picks the current locale from `document.documentElement.lang`
 * so a user on the Amharic UI gets Amharic transcription automatically.
 */

// Minimal typings for a still-experimental API.
interface SpeechRecognitionEvt {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>>;
  resultIndex: number;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvt) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type Ctor = new () => SpeechRecognitionLike;
function getCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Props {
  onResult: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export function VoiceSearch({
  onResult,
  className,
  size = 'md',
  ariaLabel = 'Voice search',
}: Props) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getCtor() != null);
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const start = () => {
    const Ctor = getCtor();
    if (!Ctor) {
      toast.error(dt('Voice input not supported on this browser'));
      return;
    }
    setBusy(true);
    try {
      const rec = new Ctor();
      rec.lang = document.documentElement.lang === 'am' ? 'am-ET' : 'en-US';
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        const first = e.results[0]?.[0]?.transcript ?? '';
        if (first) onResult(first.trim());
      };
      rec.onerror = () => {
        toast.error(dt('Could not hear you — try again'));
        setListening(false);
        setBusy(false);
      };
      rec.onend = () => {
        setListening(false);
        setBusy(false);
      };
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      toast.error(dt('Voice input unavailable'));
      setBusy(false);
    }
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  };

  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={!supported || busy}
      aria-label={ariaLabel}
      title={supported ? 'Search by voice' : 'Voice not supported'}
      className={cn(
        'relative grid place-items-center rounded-full text-white transition-transform active:scale-90',
        listening ? 'animate-pulse bg-red-500' : 'grad-hero',
        !supported && 'opacity-40',
        dim,
        className,
      )}
    >
      {busy && !listening ? (
        <Loader2 className={cn('animate-spin', icon)} />
      ) : listening ? (
        <MicOff className={icon} />
      ) : (
        <Mic className={icon} />
      )}
      {listening && <span className="absolute -inset-2 rounded-full border-2 border-red-500/40" />}
    </button>
  );
}

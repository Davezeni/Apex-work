'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpload } from '@/hooks/use-upload';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
const MIN_SECONDS = 1;
const MAX_SECONDS = 300; // 5 minutes

interface Props {
  onSend: (attachment: {
    url: string;
    type: 'audio';
    contentType: string;
    sizeBytes: number;
    durationSec: number;
    waveform?: number[];
  }) => Promise<void>;
  disabled?: boolean;
}

/**
 * Push-to-talk voice recorder. Uses the MediaRecorder API (widely supported
 * on iOS Safari 14+, Chrome/Firefox on Android, all modern desktops).
 *
 * UX:
 *   - Idle: shows a mic button; press+hold to start recording (mobile) or click to toggle (desktop).
 *   - Recording: shows a red pulsing indicator with elapsed seconds + waveform bars.
 *   - Stopped with recording: preview player + "Send" or "Discard" buttons.
 *   - Uploading: spinner overlay.
 *
 * Falls back gracefully: if the browser doesn't support the API OR the user
 * denies mic permission, the button is disabled with a hint tooltip.
 */
export function VoiceRecorder({ onSend, disabled }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'recording' | 'preview' | 'sending'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTsRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformRef = useRef<number[]>([]);
  const samplerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const upload = useUpload();

  useEffect(() => {
    return () => {
      cleanup();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (samplerRef.current) clearInterval(samplerRef.current);
    samplerRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  const startRecording = async () => {
    if (state !== 'idle' || disabled) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error(t('chat.recordFailed'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      waveformRef.current = [];

      // Best-effort waveform capture (optional; falls back to empty array).
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
          const data = new Uint8Array(analyser.frequencyBinCount);
          samplerRef.current = setInterval(() => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = (data[i]! - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            waveformRef.current.push(Math.min(1, Math.max(0, rms * 2.2)));
            if (waveformRef.current.length > 400) waveformRef.current.shift();
          }, 120);
        }
      } catch {
        /* waveform is optional */
      }

      // Prefer webm/opus (best-supported + tiny). If not available, let the
      // browser pick its default (usually mp4 on iOS Safari).
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported?.(m));
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const seconds = Math.round((Date.now() - startTsRef.current) / 1000);
        cleanup();
        if (seconds < MIN_SECONDS) {
          toast.error(t('chat.recordTooShort'));
          setState('idle');
          setSeconds(0);
          return;
        }
        setBlob(finalBlob);
        setPreviewUrl(URL.createObjectURL(finalBlob));
        setSeconds(seconds);
        setState('preview');
      };

      startTsRef.current = Date.now();
      setSeconds(0);
      setState('recording');
      recorder.start();
      timerRef.current = setInterval(() => {
        const elapsed = Math.round((Date.now() - startTsRef.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_SECONDS) stopRecording();
      }, 200);
    } catch (err) {
      const e = err as { name?: string };
      if (e.name === 'NotAllowedError') toast.error(t('chat.recordFailed'));
      else toast.error(t('chat.recordFailed'));
      cleanup();
      setState('idle');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setSeconds(0);
    setState('idle');
  };

  const send = async () => {
    if (!blob) return;
    setState('sending');
    try {
      const contentType = blob.type || 'audio/webm';
      const ext = contentType.includes('mp4')
        ? 'm4a'
        : contentType.includes('mpeg')
          ? 'mp3'
          : 'webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: contentType });
      const uploaded = await upload.mutateAsync({ file, bucket: 'chat-attachments' });
      await onSend({
        url: uploaded.publicUrl,
        type: 'audio',
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
        durationSec: seconds,
        waveform: downsample(waveformRef.current, 48),
      });
      discard();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('chat.attachFailed'));
      setState('preview');
    }
  };

  if (state === 'recording') {
    const bars = 24;
    return (
      <div className="flex flex-1 items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
        <span className="shrink-0 font-mono text-xs font-semibold text-destructive">
          {formatDuration(seconds)}
        </span>
        <div className="flex flex-1 items-center gap-[2px]">
          {Array.from({ length: bars }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-destructive/70"
              style={{
                height: `${8 + Math.abs(Math.sin(seconds * 3 + i * 0.4)) * 16}px`,
                transition: 'height .1s',
              }}
            />
          ))}
        </div>
        <button
          onClick={stopRecording}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-destructive text-white active:scale-90"
          aria-label={t('common.finish')}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if ((state === 'preview' || state === 'sending') && previewUrl) {
    const sending = state === 'sending';
    return (
      <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5">
        <button
          onClick={discard}
          disabled={sending || upload.isPending}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-destructive disabled:opacity-50"
          aria-label={dt('Discard')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <audio src={previewUrl} controls preload="metadata" className="h-8 flex-1" />
        <button
          onClick={send}
          disabled={sending}
          className="grad-hero grid h-9 w-9 shrink-0 place-items-center rounded-full text-white disabled:opacity-50"
          aria-label={t('common.post')}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  // Idle button — shown inline in the composer
  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-transform active:scale-90 disabled:opacity-50',
        'hover:bg-muted hover:text-foreground',
      )}
      aria-label={t('chat.voice')}
    >
      <Mic className="h-5 w-5" />
    </button>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Resample a raw waveform into a fixed number of bars for compact display. */
export function downsample(samples: number[], count: number): number[] {
  if (!samples.length) return [];
  if (samples.length <= count) return samples;
  const out: number[] = [];
  const step = samples.length / count;
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(samples.length, Math.floor((i + 1) * step));
    const seg = samples.slice(start, Math.max(end, start + 1));
    out.push(seg.reduce((a, b) => a + b, 0) / seg.length);
  }
  return out;
}

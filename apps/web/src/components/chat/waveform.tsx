'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

/** Compact voice-message player with an amplitude waveform + playback progress. */
export function WaveformPlayer({
  src,
  waveform,
  durationSec,
  isMine,
}: {
  src: string;
  waveform: number[];
  durationSec?: number;
  isMine?: boolean;
}) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  useEffect(() => {
    const a = audioRef.current;
    return () => {
      if (a) a.pause();
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
    } else {
      a.pause();
    }
  };

  const dur = durationSec && durationSec > 0 ? durationSec : 0;

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={playing ? t('chat.pause') : t('chat.play')}
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-full transition-transform active:scale-90',
          isMine ? 'bg-white/20 text-white' : 'bg-primary text-primary-foreground',
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex h-9 min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
        {waveform.map((v, i) => {
          const filled = progress !== 0 && i / waveform.length <= progress;
          return (
            <span
              key={i}
              className={cn(
                'w-[3px] rounded-full transition-opacity',
                isMine ? 'bg-white/70' : 'bg-muted-foreground/60',
                filled && (isMine ? 'bg-white' : 'bg-primary'),
              )}
              style={{ height: `${Math.max(3, v * 100)}%` }}
            />
          );
        })}
      </div>
      <span
        className={cn(
          'shrink-0 font-mono text-[10px]',
          isMine ? 'text-white/70' : 'text-muted-foreground',
        )}
      >
        {fmt(dur * progress) || fmt(dur)}
      </span>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setProgress(a.duration ? a.currentTime / a.duration : 0);
        }}
        className="hidden"
      />
    </div>
  );
}

function fmt(sec: number): string {
  if (!sec || Number.isNaN(sec) || !isFinite(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

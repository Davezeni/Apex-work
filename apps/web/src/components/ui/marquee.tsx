'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Horizontal auto-scroll marquee (requestAnimationFrame). The content is
 * rendered twice; the track loops seamlessly over half its width. Pauses
 * while hovered/pressed. Deliberately NOT gated behind prefers-reduced-
 * motion: this is a product decision for the marketing surfaces — the
 * motion is slow, purely decorative, and content remains fully readable
 * and clickable while it runs (and frozen while hovered/pressed).
 */
export function Marquee({
  children,
  speed = 45,
  className,
}: {
  children: ReactNode;
  /** pixels per second */
  speed?: number;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let half = 0;
    const measure = () => {
      half = track.scrollWidth / 2;
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(track);

    let raf = 0;
    let paused = false;
    let pos = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused && half > 0) {
        pos = (pos + speed * dt) % half;
        track.style.transform = `translateX(${-pos}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const el = track.parentElement;
    const pause = () => {
      paused = true;
    };
    const resume = () => {
      paused = false;
      last = performance.now();
    };
    el?.addEventListener('pointerenter', pause);
    el?.addEventListener('pointerleave', resume);
    el?.addEventListener('pointerdown', pause);
    el?.addEventListener('pointerup', resume);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el?.removeEventListener('pointerenter', pause);
      el?.removeEventListener('pointerleave', resume);
      el?.removeEventListener('pointerdown', pause);
      el?.removeEventListener('pointerup', resume);
    };
  }, [speed]);

  return (
    <div className={className}>
      <div ref={trackRef} className="flex w-max will-change-transform">
        <div className="flex shrink-0">{children}</div>
        <div aria-hidden="true" className="flex shrink-0">
          {children}
        </div>
      </div>
    </div>
  );
}

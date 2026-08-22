'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { REACTION_EMOJIS, type ReactionEmoji } from '@apex-work/shared';

interface Props {
  open: boolean;
  onSelect: (e: ReactionEmoji) => void;
  onClose: () => void;
}

/**
 * Popover with the 8 reaction emojis. Closes on outside-click / Escape.
 * Deliberately tiny — no keyboard focus trap because the emojis are all
 * hit-testable buttons in a single row.
 */
export function ReactionPicker({ open, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          className="absolute -top-11 left-0 z-30 flex gap-0.5 rounded-full border border-border bg-card px-1.5 py-1 shadow-xl"
        >
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => { onSelect(e); onClose(); }}
              className="grid h-8 w-8 place-items-center rounded-full text-lg transition-transform hover:scale-125 active:scale-110"
              aria-label={`React with ${e}`}
            >
              {e}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

'use client';

import { useRef } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUpload } from '@/hooks/use-upload';
import { useI18n } from '@/i18n';
import { ATTACHMENT_ACCEPT } from '@/lib/file-types';

interface Props {
  onAttached: (info: {
    url: string;
    type: 'image' | 'file';
    contentType: string;
    sizeBytes: number;
    name: string;
  }) => Promise<void>;
  disabled?: boolean;
}

/**
 * Paper-clip icon that opens a file picker, then uploads to Supabase
 * Storage via the signed-URL flow and hands the resulting public URL
 * back to the caller. Deliberately narrow scope: no drag+drop, no
 * multiple files. Chat UIs benefit from being predictable.
 */
export function AttachButton({ onAttached, disabled }: Props) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUpload();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error(t('chat.attachTooLarge'));
      return;
    }

    try {
      const uploaded = await upload.mutateAsync({
        file,
        bucket: 'chat-attachments',
      });
      const type = uploaded.contentType.startsWith('image/') ? 'image' : 'file';
      await onAttached({
        url: uploaded.publicUrl,
        type,
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
        name: file.name,
      });
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('chat.attachFailed'));
    }
  };

  return (
    <>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={disabled || upload.isPending}
        aria-label={t('chat.attach')}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-transform active:scale-90 disabled:opacity-50 hover:bg-muted hover:text-foreground"
      >
        {upload.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Paperclip className="h-5 w-5" />
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        onChange={onFile}
        className="hidden"
      />
    </>
  );
}

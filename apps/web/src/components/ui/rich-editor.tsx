'use client';

import { dt } from '@/i18n/auto';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Heading2,
  Quote,
  Code,
} from 'lucide-react';
import { cn } from '@/lib/utils';
interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  maxChars?: number;
}

/**
 * Rich text editor. TipTap wrapper with a Fiverr/LinkedIn-style toolbar.
 * Persists as SANITIZED HTML (TipTap's schema only permits a small
 * whitelist of nodes/marks, so this is XSS-safe by construction — no
 * arbitrary elements, no inline scripts, no data URIs on href).
 *
 * value/onChange are string HTML for easy round-tripping with the API.
 * We also count *plain text* characters against maxChars so users can't
 * blow through limits by nesting long formatting.
 */
export function RichEditor({
  value,
  onChange,
  placeholder,
  className,
  minRows = 6,
  maxChars,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'nofollow noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write something…' }),
    ],
    content: value || '',
    // Never mount the DOM until the client is mounted — avoids SSR mismatch.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-invert prose-sm max-w-none focus:outline-none',
          'min-h-[120px] px-3 py-2 leading-relaxed',
        ),
        style: `min-height: ${minRows * 24}px`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Plain-text length cap: prefer clipping in-editor over silent truncation.
      if (maxChars && editor.getText().length > maxChars) {
        editor.commands.undo();
        return;
      }
      onChange(html);
    },
  });

  // Keep editor in sync when a parent hard-resets the value (e.g. AI enhance).
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20',
        className,
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {maxChars && (
        <div className="border-t border-border px-3 py-1 text-right text-[10px] text-muted-foreground">
          {editor.getText().length} / {maxChars}
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const promptLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };
  const btn = (active: boolean) =>
    cn(
      'grid h-8 w-8 place-items-center rounded-md text-sm transition-colors',
      active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted',
    );
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background/60 px-2 py-1">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive('bold'))}
        aria-label={dt('Bold')}
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive('italic'))}
        aria-label={dt('Italic')}
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive('heading', { level: 2 }))}
        aria-label={dt('Heading')}
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive('bulletList'))}
        aria-label={dt('Bullet list')}
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive('orderedList'))}
        aria-label={dt('Ordered list')}
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive('blockquote'))}
        aria-label={dt('Quote')}
      >
        <Quote className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btn(editor.isActive('codeBlock'))}
        aria-label={dt('Code')}
      >
        <Code className="h-4 w-4" />
      </button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        onClick={promptLink}
        className={btn(editor.isActive('link'))}
        aria-label={dt('Link')}
      >
        <LinkIcon className="h-4 w-4" />
      </button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        className={btn(false)}
        aria-label={dt('Undo')}
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        className={btn(false)}
        aria-label={dt('Redo')}
      >
        <Redo2 className="h-4 w-4" />
      </button>
    </div>
  );
}

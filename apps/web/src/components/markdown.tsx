'use client';

import React from 'react';

/**
 * Minimal, dependency-free, XSS-safe Markdown renderer for admin-editable
 * site content (privacy/terms/cookies/faq).
 *
 * Supports the subset we need: #–#### headings, paragraphs, **bold**,
 * *italic*, `inline code` (and fenced code blocks), [links](url),
 * - / 1. lists, and > blockquotes. All raw HTML is escaped; links only open
 * for safe schemes (http/https/mailto), so an admin can't inject scripts.
 */

/** HTML-escape a string so raw markup can never render as tags. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render inline markdown → safe React nodes. */
function inline(text: string): React.ReactNode[] {
  // Escape first so any HTML is inert, then apply markdown tokens via regex.
  let s = esc(text);

  // [text](url) — only allow safe URL schemes.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, url) => {
    const clean = url.trim();
    const safe = /^(https?:\/\/|mailto:)/i.test(clean);
    if (!safe) return whole;
    return `<a href="${clean}">${label}</a>`;
  });

  // `inline code` -> <code>
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // **bold**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // *italic*
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Split on the tags we just produced so we can interleave React elements
  // (dangerouslySetInnerHTML is avoided entirely).
  const tokens = s.split(
    /(<a [^>]*>[^<]*<\/a>|<code>[^<]*<\/code>|<strong>[^<]*<\/strong>|<em>[^<]*<\/em>)/g,
  );
  const out: React.ReactNode[] = [];
  tokens.forEach((tok, i) => {
    if (tok.startsWith('<a ')) {
      const href = /href="([^"]+)"/.exec(tok)?.[1] ?? '#';
      const label = tok.replace(/^<a [^>]*>/, '').replace(/<\/a>$/, '');
      out.push(
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          {label}
        </a>,
      );
    } else if (tok.startsWith('<code>')) {
      out.push(
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {tok.replace(/^<code>/, '').replace(/<\/code>$/, '')}
        </code>,
      );
    } else if (tok.startsWith('<strong>')) {
      out.push(<strong key={i}>{tok.replace(/^<strong>/, '').replace(/<\/strong>$/, '')}</strong>);
    } else if (tok.startsWith('<em>')) {
      out.push(<em key={i}>{tok.replace(/^<em>/, '').replace(/<\/em>$/, '')}</em>);
    } else if (tok) {
      out.push(tok);
    }
  });
  return out;
}

function renderInlineText(s: string): React.ReactNode[] {
  return inline(s);
}

export function Markdown({ children }: { children: string }) {
  const lines = children.split('\n');
  const blocks: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let codeBuf: string[] | null = null;
  let quoteBuf: string[] = [];

  const flushList = () => {
    if (!listType) return;
    const Lis = listItems.map((it, i) => <li key={i}>{inline(it)}</li>);
    if (listType === 'ol')
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="my-2 list-decimal pl-5">
          {Lis}
        </ol>,
      );
    else
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-2 list-disc pl-5">
          {Lis}
        </ul>,
      );
    listItems = [];
    listType = null;
  };
  const flushQuote = () => {
    if (!quoteBuf.length) return;
    blocks.push(
      <blockquote
        key={`bq-${blocks.length}`}
        className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground"
      >
        {quoteBuf.map((q, i) => (
          <p key={i}>{inline(q)}</p>
        ))}
      </blockquote>,
    );
    quoteBuf = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');

    // fenced code block
    if (line.trimStart().startsWith('```')) {
      if (codeBuf === null) {
        flushList();
        flushQuote();
        codeBuf = [];
      } else {
        blocks.push(
          <pre
            key={`code-${blocks.length}`}
            className="my-3 overflow-x-auto rounded-xl border border-border bg-muted p-3 text-xs"
          >
            <code className="font-mono">{codeBuf.join('\n')}</code>
          </pre>,
        );
        codeBuf = null;
      }
      continue;
    }
    if (codeBuf !== null) {
      codeBuf.push(line);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      flushQuote();
      const level = (heading[1] ?? '').length;
      const Tag = `h${Math.min(level + 1, 4)}` as 'h2' as React.ElementType;
      blocks.push(
        <Tag key={`h-${blocks.length}`} className="mb-2 mt-5 font-bold">
          {renderInlineText(heading[2] ?? '')}
        </Tag>,
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushList();
      quoteBuf.push(line.replace(/^\s*>\s?/, ''));
      continue;
    }
    flushQuote();

    const ulItem = /^\s*[-*]\s+(.*)$/.exec(line);
    const olItem = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ulItem || olItem) {
      if (listType !== (ulItem ? 'ul' : 'ol')) {
        flushList();
        listType = ulItem ? 'ul' : 'ol';
      }
      listItems.push(ulItem ? (ulItem[1] ?? '') : (olItem![1] ?? ''));
      continue;
    }

    const blank = /^\s*$/.test(line);
    if (!blank) {
      flushList();
      blocks.push(
        <p key={`p-${blocks.length}`} className="my-2 leading-relaxed">
          {renderInlineText(line)}
        </p>,
      );
    }
  }
  flushList();
  flushQuote();
  if (codeBuf !== null) {
    blocks.push(
      <pre
        key={`code-${blocks.length}`}
        className="my-3 overflow-x-auto rounded-xl border border-border bg-muted p-3 text-xs"
      >
        <code className="font-mono">{codeBuf.join('\n')}</code>
      </pre>,
    );
  }

  return <div className="text-sm leading-relaxed">{blocks}</div>;
}

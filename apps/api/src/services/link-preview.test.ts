import { describe, expect, it } from 'vitest';
import { decodeEntities, isBlockedHost, parseOpenGraph, unfurl } from './link-preview.js';

describe('link-preview parse', () => {
  it('extracts OpenGraph metadata with both attribute orders', () => {
    const html = `<!doctype html><html><head>
      <title>Fallback Title</title>
      <meta property="og:title" content="Example Domain" />
      <meta property="og:description" content="A nice demo site &amp; more" />
      <meta property="og:image" content="/img/cover.png" />
      <meta property="og:site_name" content="Example" />
      <meta name="twitter:title" content="Twitter title" />
    </head><body></body></html>`;
    const p = parseOpenGraph(html, 'https://example.com/page');
    expect(p.title).toBe('Example Domain');
    expect(p.description).toBe('A nice demo site & more');
    expect(p.image).toBe('https://example.com/img/cover.png');
    expect(p.siteName).toBe('Example');
    expect(p.domain).toBe('example.com');
  });

  it('falls back to <title> when og:title is absent', () => {
    const p = parseOpenGraph('<html><head><title>My  Site </title></head></html>', 'https://a.test');
    // decodeEntities trims; multi-space from title is collapsed.
    expect(p.title).toBe('My Site');
  });

  it('handles attribute order reversed (content before property)', () => {
    const html = `<meta content="Reversed" property="og:description">`;
    const p = parseOpenGraph(html, 'https://x.test');
    expect(p.description).toBe('Reversed');
  });

  it('rejects non-http image schemes', () => {
    const html = `<meta property="og:image" content="data:image/png;base64,xxx">`;
    const p = parseOpenGraph(html, 'https://x.test');
    expect(p.image).toBeUndefined();
  });

  it('returns a bare domain card when no metadata is present', () => {
    const p = parseOpenGraph('<html></html>', 'https://example.co.uk/path');
    expect(p.domain).toBe('example.co.uk');
    expect(p.title).toBeUndefined();
    expect(p.image).toBeUndefined();
  });
});

describe('link-preview decodeEntities', () => {
  it('decodes common entities and numeric refs', () => {
    expect(decodeEntities('a &amp; b &#39;c&#39; &lt;x&gt; &nbsp;y&nbsp;')).toBe("a & b 'c' <x>  y");
  });
});

describe('link-preview SSRF guard', () => {
  it('blocks private and loopback hosts', () => {
    for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.1', '169.254.1.1', '0.0.0.0', '::1']) {
      expect(isBlockedHost(h)).toBe(true);
    }
  });

  it('allows public hosts', () => {
    for (const h of ['example.com', 'github.com', 'www.example.org']) {
      expect(isBlockedHost(h)).toBe(false);
    }
  });
});

describe('link-preview unfurl guard', () => {
  it('rejects non-http(s) schemes without network', async () => {
    await expect(unfurl('ftp://x')).rejects.toThrow(/http/i);
  });

  it('rejects private hosts without network', async () => {
    await expect(unfurl('http://127.0.0.1/x')).rejects.toThrow(/Blocked|Invalid/i);
  });

  it('rejects unparseable urls', async () => {
    await expect(unfurl('not a url')).rejects.toThrow(/Invalid URL/);
  });
});

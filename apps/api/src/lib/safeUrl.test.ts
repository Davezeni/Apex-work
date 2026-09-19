import { describe, expect, it } from 'vitest';
import { assertPublicUrl, assertResolvablePublicHost, isInternalAddress, isPrivateHost } from './safeUrl.js';

describe('isPrivateHost', () => {
  it('blocks internal hostnames and ALL IPv4 literals', () => {
    for (const host of ['localhost', 'localhost.local', '10.0.0.5', '127.0.0.1', '169.254.169.254', '8.8.8.8', '192.168.1.1', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fd00::5', 'metadata.internal', 'box.local']) {
      expect(isPrivateHost(host), host).toBe(true);
    }
  });
  it('allows public domain names', () => {
    for (const host of ['example.com', 'supabase.co', 'storage.googleapis.com', 'api.groq.com']) {
      expect(isPrivateHost(host), host).toBe(false);
    }
  });
});

describe('isInternalAddress', () => {
  it('detects every internal range including cloud metadata', () => {
    for (const addr of ['0.1.2.3', '10.1.2.3', '127.0.0.1', '100.64.0.1', '100.127.255.254', '169.254.169.254', '172.16.0.1', '172.31.255.254', '192.168.0.1', '::1', '::ffff:10.0.0.1', 'fe80::1', 'fd12::1']) {
      expect(isInternalAddress(addr), addr).toBe(true);
    }
    for (const addr of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.63.0.1', '192.169.0.1', '2606:4700::1']) {
      expect(isInternalAddress(addr), addr).toBe(false);
    }
  });
});

describe('assertPublicUrl', () => {
  it('rejects schemes, userinfo and internal hosts', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow('SCHEME');
    await expect(assertPublicUrl('ftp://example.com/x')).rejects.toThrow('SCHEME');
    await expect(assertPublicUrl('https://user:pass@example.com/')).rejects.toThrow('USERINFO');
    await expect(assertPublicUrl('http://127.0.0.1:4000/v1/health')).rejects.toThrow('PRIVATE_HOST');
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow('PRIVATE_HOST');
    await expect(assertPublicUrl('http://localhost:4000/')).rejects.toThrow('PRIVATE_HOST');
    await expect(assertPublicUrl('not a url at all')).rejects.toThrow('INVALID_URL');
  });

  it('rejects public-looking DNS that resolves into private space', async () => {
    await expect(assertPublicUrl('http://localhost/x')).rejects.toThrow();
    // 10.0.0.5.nip.io resolves to 10.0.0.5 (needs network — CI/sandbox have it)
    await expect(assertPublicUrl('https://10.0.0.5.nip.io/secret')).rejects.toThrow('PRIVATE_DNS');
  });

  it('accepts genuine public URLs', async () => {
    await expect(assertPublicUrl('https://example.com/')).resolves.toBeInstanceOf(URL);
  });
});

describe('assertResolvablePublicHost', () => {
  it('blocks internal hosts and private-resolving DNS, allows public', async () => {
    await expect(assertResolvablePublicHost('127.0.0.1')).rejects.toThrow('PRIVATE_HOST');
    await expect(assertResolvablePublicHost('10.0.0.5.nip.io')).rejects.toThrow('PRIVATE_DNS');
    await expect(assertResolvablePublicHost('example.com')).resolves.toBeUndefined();
  });
});

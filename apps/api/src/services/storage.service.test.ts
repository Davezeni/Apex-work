import { describe, expect, it } from 'vitest';
import { StorageService } from './storage.service.js';

describe('StorageService upload validation', () => {
  const storage = new StorageService();

  it('strips recorder codec parameters', () => {
    expect(storage.normalizeContentType('audio/webm;codecs=opus', 'voice.webm')).toBe('audio/webm');
  });

  it('infers Office MIME types when a mobile picker reports octet-stream', () => {
    expect(storage.normalizeContentType('application/octet-stream', 'proposal.docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(storage.normalizeContentType('application/octet-stream', 'budget.xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('allows supported chat and portfolio files within limits', () => {
    expect(storage.validate({
      bucket: 'chat-attachments',
      filename: 'brief.docx',
      contentType: 'application/octet-stream',
      sizeBytes: 1024,
    }).ok).toBe(true);
    expect(storage.validate({
      bucket: 'portfolio',
      filename: 'case-study.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    }).ok).toBe(true);
  });

  it('keeps profile avatars image-only and enforces the 5 MB cap', () => {
    expect(storage.validate({
      bucket: 'avatars',
      filename: 'avatar.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    }).ok).toBe(false);
    expect(storage.validate({
      bucket: 'avatars',
      filename: 'avatar.png',
      contentType: 'image/png',
      sizeBytes: 6 * 1024 * 1024,
    }).ok).toBe(false);
  });
});

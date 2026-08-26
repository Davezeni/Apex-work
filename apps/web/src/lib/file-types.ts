const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.rtf': 'application/rtf',
};

export const ATTACHMENT_ACCEPT =
  'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf';

export const PORTFOLIO_ACCEPT =
  'image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf';

export function contentTypeForFile(file: Pick<File, 'name' | 'type'>): string {
  const bare = (file.type || '').split(';')[0]?.trim().toLowerCase();
  if (bare && bare !== 'application/octet-stream') return bare;
  const dot = file.name.lastIndexOf('.');
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  return MIME_BY_EXTENSION[extension] ?? bare ?? 'application/octet-stream';
}

export function isImageType(contentType: string, url = ''): boolean {
  if (contentType.toLowerCase().startsWith('image/')) return true;
  return /\.(?:jpe?g|png|webp|gif)(?:[?#]|$)/i.test(url);
}

export function isVideoType(contentType: string, url = ''): boolean {
  if (contentType.toLowerCase().startsWith('video/')) return true;
  return /\.(?:mp4|webm|mov)(?:[?#]|$)/i.test(url);
}

export function extensionOf(nameOrUrl: string): string {
  const clean = nameOrUrl.split(/[?#]/)[0] ?? nameOrUrl;
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toUpperCase() : 'FILE';
}

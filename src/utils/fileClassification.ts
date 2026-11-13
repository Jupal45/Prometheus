import type { FileCategory, VaultFileMeta, ZipEntryItem } from '../types/vault';

const IMAGE_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'svg',
  'bmp',
  'avif',
  'ico',
  'tiff',
  'tif',
  'heic',
  'heif',
]);

const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz']);

const AUDIO_EXTS = new Set([
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'flac',
  'aac',
  'opus',
  'weba',
]);

const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v']);

const DOCUMENT_EXTS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'xml',
  'html',
  'htm',
  'rtf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'css',
  'yaml',
  'yml',
  'log',
]);

const TEXT_READABLE_EXTS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'xml',
  'html',
  'htm',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'css',
  'yaml',
  'yml',
  'log',
  'svg',
]);

export function getExtension(filename: string): string {
  const clean = filename.split('?')[0].split('#')[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1).toLowerCase();
}

export function classifyFile(filename: string, mimeType = ''): FileCategory {
  const ext = getExtension(filename);
  const mime = mimeType.toLowerCase();

  if (ext === 'pdf' || mime === 'application/pdf') {
    return 'pdf';
  }
  if (IMAGE_EXTS.has(ext) || mime.startsWith('image/')) {
    return 'image';
  }
  if (
    ARCHIVE_EXTS.has(ext) ||
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/x-rar-compressed'
  ) {
    return 'archive';
  }
  if (AUDIO_EXTS.has(ext) || mime.startsWith('audio/')) {
    return 'audio';
  }
  if (VIDEO_EXTS.has(ext) || mime.startsWith('video/')) {
    return 'video';
  }
  if (DOCUMENT_EXTS.has(ext) || mime.startsWith('text/')) {
    return 'document';
  }
  return 'other';
}

export function isZipArchive(filename: string, mimeType = ''): boolean {
  const ext = getExtension(filename);
  const mime = mimeType.toLowerCase();
  return (
    ext === 'zip' ||
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed'
  );
}

export function isTextReadable(filename: string, mimeType = ''): boolean {
  const ext = getExtension(filename);
  const mime = mimeType.toLowerCase();
  return (
    TEXT_READABLE_EXTS.has(ext) ||
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml'
  );
}

export function guessMimeType(filename: string, fallback = 'application/octet-stream'): string {
  if (fallback === 'audio/mp3' || fallback === 'audio/x-mp3') {
    return 'audio/mpeg';
  }
  if (fallback && fallback !== 'application/octet-stream') return fallback;
  const ext = getExtension(filename);
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    zip: 'application/zip',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return map[ext] || fallback || 'application/octet-stream';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return idx === 0 ? `${bytes} B` : `${value.toFixed(1)} ${units[idx]}`;
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatShortDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

export function categoryLabelEs(category: FileCategory): string {
  switch (category) {
    case 'image':
      return 'Fotografía';
    case 'pdf':
      return 'PDF';
    case 'document':
      return 'Documento';
    case 'archive':
      return 'Archivero';
    case 'audio':
      return 'Audio';
    case 'video':
      return 'Video';
    default:
      return 'Archivo';
  }
}

export function filterVisibleZipEntries(entries: ZipEntryItem[]): ZipEntryItem[] {
  return entries
    .filter((entry) => {
      if (entry.isDir) return false;
      const base = entry.name;
      if (!base || base.startsWith('__MACOSX') || entry.path.startsWith('__MACOSX/')) {
        return false;
      }
      if (base === '.DS_Store' || base === 'Thumbs.db') {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path, 'es'));
}

export function filterGalleryFiles(
  files: VaultFileMeta[],
  filter: 'all' | 'image' | 'document' | 'archive',
  searchQuery: string
): VaultFileMeta[] {
  const q = searchQuery.trim().toLowerCase();
  return files.filter((file) => {
    // Only show root-level files in main gallery (files placed inside custom Archiveros appear inside that Archivero)
    if (file.folderId !== null) return false;

    if (filter === 'image' && file.category !== 'image' && file.category !== 'video') {
      return false;
    }
    if (filter === 'document' && file.category !== 'pdf' && file.category !== 'document' && file.category !== 'other') {
      return false;
    }
    if (filter === 'archive' && file.category !== 'archive') {
      return false;
    }
    if (q && !file.name.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}

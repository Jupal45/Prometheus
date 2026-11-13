export type FileCategory =
  | 'image'
  | 'pdf'
  | 'document'
  | 'archive'
  | 'audio'
  | 'video'
  | 'other';

export interface VaultFileMeta {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  category: FileCategory;
  createdAt: number;
  folderId: string | null;
  sha256: string;
}

export interface VaultFolder {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  createdAt: number;
  trackIds: string[];
}

export interface VaultManifest {
  version: number;
  files: VaultFileMeta[];
  folders: VaultFolder[];
  playlists: MusicPlaylist[];
}

export interface VaultSecurityConfig {
  version: number;
  saltB64: string;
  iterations: number;
  phase1HashB64: string;
  phase2HashB64: string;
  phase3HashB64: string;
  phase3Prompt: string;
  createdAt: number;
  updatedAt: number;
}

export interface ZipEntryItem {
  path: string;
  name: string;
  size: number;
  compressedSize: number;
  isDir: boolean;
  category: FileCategory;
  mimeType: string;
}

export type AppSection = 'gallery' | 'archives' | 'music' | 'security';
export type GalleryFilter = 'all' | 'image' | 'document' | 'archive';

import JSZip from 'jszip';
import type {
  MusicPlaylist,
  VaultFileMeta,
  VaultFolder,
  VaultManifest,
} from '../types/vault';
import { classifyFile, guessMimeType } from './fileClassification';

export const BACKUP_MANIFEST_FILENAME = 'prometheus-respaldo.json';

export interface BackupFileEntry {
  originalId: string;
  name: string;
  size: number;
  mimeType: string;
  category: VaultFileMeta['category'];
  createdAt: number;
  folderId: string | null;
  sha256: string;
  archivePath: string;
}

export interface PrometheusBackupPayload {
  version: number;
  app: 'Prometheus';
  exportedAt: number;
  folders: VaultFolder[];
  playlists: MusicPlaylist[];
  files: BackupFileEntry[];
}

export interface ParsedBackupArchive {
  exportedAt: number;
  folders: VaultFolder[];
  playlists: MusicPlaylist[];
  files: Array<{
    entry: BackupFileEntry;
    bytes: Uint8Array;
  }>;
}

function sanitizeZipSegment(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

export async function buildVaultBackupZip(
  manifest: VaultManifest,
  readFileBytes: (fileId: string) => Promise<Uint8Array>
): Promise<Uint8Array> {
  const zip = new JSZip();
  const backupFiles: BackupFileEntry[] = [];

  for (let i = 0; i < manifest.files.length; i++) {
    const file = manifest.files[i];
    const bytes = await readFileBytes(file.id);
    const safeName = sanitizeZipSegment(file.name) || `archivo_${i + 1}`;
    const archivePath = `archivos/${String(i + 1).padStart(3, '0')}_${safeName}`;
    zip.file(archivePath, bytes);
    backupFiles.push({
      originalId: file.id,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      category: file.category,
      createdAt: file.createdAt,
      folderId: file.folderId,
      sha256: file.sha256,
      archivePath,
    });
  }

  const payload: PrometheusBackupPayload = {
    version: 1,
    app: 'Prometheus',
    exportedAt: Date.now(),
    folders: manifest.folders,
    playlists: manifest.playlists,
    files: backupFiles,
  };

  zip.file(BACKUP_MANIFEST_FILENAME, JSON.stringify(payload, null, 2));
  return zip.generateAsync({ type: 'uint8array' });
}

export async function parseVaultBackupZip(
  zipBytes: Uint8Array
): Promise<ParsedBackupArchive> {
  const zip = await JSZip.loadAsync(zipBytes);
  const manifestFile = zip.file(BACKUP_MANIFEST_FILENAME);

  if (!manifestFile) {
    throw new Error(
      'El archivo seleccionado no contiene un respaldo válido de Prometheus.'
    );
  }

  const rawJson = await manifestFile.async('string');
  const parsed = JSON.parse(rawJson) as PrometheusBackupPayload;

  if (parsed.app !== 'Prometheus' || !Array.isArray(parsed.files)) {
    throw new Error('Formato de respaldo no reconocido.');
  }

  const restoredFiles: ParsedBackupArchive['files'] = [];
  for (const entry of parsed.files) {
    const zipEntry = zip.file(entry.archivePath);
    if (!zipEntry) continue;
    const bytes = await zipEntry.async('uint8array');
    const mimeType = guessMimeType(entry.name, entry.mimeType);
    const category = classifyFile(entry.name, mimeType);
    restoredFiles.push({
      entry: {
        ...entry,
        mimeType,
        category,
        size: bytes.byteLength,
      },
      bytes,
    });
  }

  return {
    exportedAt: parsed.exportedAt || Date.now(),
    folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
    files: restoredFiles,
  };
}

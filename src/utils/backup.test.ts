import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVaultBackupZip, parseVaultBackupZip } from './backup';
import type { VaultManifest } from '../types/vault';

test('buildVaultBackupZip and parseVaultBackupZip preserve files, folders, and playlists cleanly', async () => {
  const sampleMp3 = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x01]);
  const sampleText = new TextEncoder().encode('Documento privado respaldado');

  const manifest: VaultManifest = {
    version: 1,
    folders: [
      {
        id: 'folder-1',
        name: 'Viajes',
        description: 'Archivero privado',
        createdAt: 1700000000000,
      },
    ],
    playlists: [
      {
        id: 'pl-1',
        name: 'Favoritas',
        createdAt: 1700000000000,
        trackIds: ['file-mp3'],
      },
    ],
    files: [
      {
        id: 'file-mp3',
        name: 'Cancion_Serena.mp3',
        size: sampleMp3.byteLength,
        mimeType: 'audio/mpeg',
        category: 'audio',
        createdAt: 1700000000000,
        folderId: null,
        sha256: 'abc',
      },
      {
        id: 'file-txt',
        name: 'Nota.txt',
        size: sampleText.byteLength,
        mimeType: 'text/plain',
        category: 'document',
        createdAt: 1700000001000,
        folderId: 'folder-1',
        sha256: 'def',
      },
    ],
  };

  const blobMap: Record<string, Uint8Array> = {
    'file-mp3': sampleMp3,
    'file-txt': sampleText,
  };

  const zipBytes = await buildVaultBackupZip(
    manifest,
    async (id) => blobMap[id]
  );

  const restored = await parseVaultBackupZip(zipBytes);
  assert.equal(restored.folders.length, 1);
  assert.equal(restored.folders[0].name, 'Viajes');
  assert.equal(restored.playlists.length, 1);
  assert.equal(restored.playlists[0].trackIds[0], 'file-mp3');
  assert.equal(restored.files.length, 2);
  assert.equal(restored.files[0].entry.name, 'Cancion_Serena.mp3');
  assert.equal(restored.files[0].entry.category, 'audio');
  assert.deepEqual(restored.files[0].bytes, sampleMp3);
  assert.deepEqual(restored.files[1].bytes, sampleText);
});

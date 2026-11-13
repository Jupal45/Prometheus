import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  classifyFile,
  filterGalleryFiles,
  filterVisibleZipEntries,
  formatBytes,
  formatDuration,
  isZipArchive,
} from './fileClassification';
import {
  buildSamplePdfBytes,
  buildSampleZipBytes,
} from './syntheticSeedAssets';
import {
  getNextTrackIndex,
  validatePhase1Password,
  validatePhase2Pin,
  validatePhase3Key,
} from './vaultState';
import type { VaultFileMeta } from '../types/vault';

test('classifyFile categorizes photos, PDFs, documents, ZIPs, audio, video, and unknown formats', () => {
  assert.equal(classifyFile('lago.jpg'), 'image');
  assert.equal(classifyFile('captura.PNG'), 'image');
  assert.equal(classifyFile('contrato.pdf'), 'pdf');
  assert.equal(classifyFile('respaldo.zip'), 'archive');
  assert.equal(classifyFile('notas.md'), 'document');
  assert.equal(classifyFile('cancion.mp3'), 'audio');
  assert.equal(classifyFile('clip.mp4'), 'video');
  assert.equal(classifyFile('binario.dat'), 'other');
  assert.equal(isZipArchive('paquete.zip'), true);
  assert.equal(isZipArchive('foto.png'), false);
});

test('filterGalleryFiles excludes nested folder files and filters by category and search', () => {
  const files: VaultFileMeta[] = [
    {
      id: '1',
      name: 'Playa.jpg',
      size: 1000,
      mimeType: 'image/jpeg',
      category: 'image',
      createdAt: 1,
      folderId: null,
      sha256: 'a',
    },
    {
      id: '2',
      name: 'Archivo.zip',
      size: 2000,
      mimeType: 'application/zip',
      category: 'archive',
      createdAt: 2,
      folderId: null,
      sha256: 'b',
    },
    {
      id: '3',
      name: 'Secreta.txt',
      size: 300,
      mimeType: 'text/plain',
      category: 'document',
      createdAt: 3,
      folderId: 'folder-1',
      sha256: 'c',
    },
  ];

  assert.equal(filterGalleryFiles(files, 'all', '').length, 2);
  assert.equal(filterGalleryFiles(files, 'archive', '').length, 1);
  assert.equal(filterGalleryFiles(files, 'all', 'playa').length, 1);
});

test('synthetic ZIP builder creates readable nested entries and filters system artifacts', async () => {
  const zipBytes = await buildSampleZipBytes(new Uint8Array([1, 2, 3]));
  const zip = await JSZip.loadAsync(zipBytes);
  const rawEntries = Object.values(zip.files).map((entry) => ({
    path: entry.name,
    name: entry.name.split('/').pop() || entry.name,
    size: 10,
    compressedSize: 5,
    isDir: entry.dir,
    category: classifyFile(entry.name),
    mimeType: '',
  }));

  const visible = filterVisibleZipEntries(rawEntries);
  assert.equal(visible.length, 3);
  assert.equal(visible.some((e) => e.name === 'Fotografia_Interior.jpg'), true);

  const pdfBytes = buildSamplePdfBytes();
  const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 8));
  assert.equal(pdfHeader, '%PDF-1.4');
});

test('3-phase credential validators and formatters enforce constraints', () => {
  assert.equal(validatePhase1Password('abc').valid, false);
  assert.equal(validatePhase1Password('segura12').valid, true);

  assert.equal(validatePhase2Pin('12345').valid, false);
  assert.equal(validatePhase2Pin('12a456').valid, false);
  assert.equal(validatePhase2Pin('123456').valid, true);

  assert.equal(validatePhase3Key('ab').valid, false);
  assert.equal(validatePhase3Key('amanecer').valid, true);

  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatDuration(125), '2:05');
  assert.equal(getNextTrackIndex(0, 3, 'next', false), 1);
  assert.equal(getNextTrackIndex(0, 3, 'prev', false), 2);
});

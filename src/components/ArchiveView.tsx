import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import {
  Archive,
  ArrowLeft,
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Music,
  Plus,
  Trash2,
} from 'lucide-react';
import type { VaultFileMeta, VaultFolder, ZipEntryItem } from '../types/vault';
import {
  categoryLabelEs,
  classifyFile,
  filterVisibleZipEntries,
  formatBytes,
  formatShortDate,
  guessMimeType,
} from '../utils/fileClassification';
import type { FullscreenImageItem } from './FullscreenPhotoViewer';
import type { DocumentViewerTarget } from './DocumentViewerModal';

interface ArchiveViewProps {
  mode: 'zip' | 'folder';
  zipFile?: VaultFileMeta;
  zipBytes?: Uint8Array;
  folder?: VaultFolder;
  folderFiles?: VaultFileMeta[];
  decryptedThumbnails: Record<string, string>;
  onBack: () => void;
  onOpenFullscreenImages: (images: FullscreenImageItem[], index: number) => void;
  onOpenDocument: (target: DocumentViewerTarget) => void;
  onPlayExternalAudio: (name: string, mimeType: string, bytes: Uint8Array) => void;
  onOpenVaultFile: (file: VaultFileMeta) => void;
  onImportIntoFolder?: (folderId: string) => void;
  onDeleteVaultFile?: (file: VaultFileMeta) => void;
}

export function ArchiveView({
  mode,
  zipFile,
  zipBytes,
  folder,
  folderFiles = [],
  decryptedThumbnails,
  onBack,
  onOpenFullscreenImages,
  onOpenDocument,
  onPlayExternalAudio,
  onOpenVaultFile,
  onImportIntoFolder,
  onDeleteVaultFile,
}: ArchiveViewProps) {
  const [zipEntries, setZipEntries] = useState<ZipEntryItem[]>([]);
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
  const [zipThumbUrls, setZipThumbUrls] = useState<Record<string, string>>({});
  const [zipError, setZipError] = useState<string | null>(null);
  const [isLoadingZip, setIsLoadingZip] = useState(false);

  useEffect(() => {
    if (mode !== 'zip' || !zipBytes) {
      setZipEntries([]);
      setZipInstance(null);
      setZipThumbUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    async function parseZip() {
      setIsLoadingZip(true);
      setZipError(null);
      try {
        const zip = await JSZip.loadAsync(zipBytes!);
        if (cancelled) return;
        setZipInstance(zip);

        const rawList: ZipEntryItem[] = Object.values(zip.files).map((entry) => {
          const cleanPath = entry.name;
          const baseName = cleanPath.split('/').filter(Boolean).pop() || cleanPath;
          const mimeType = guessMimeType(baseName);
          const category = classifyFile(baseName, mimeType);
          const internalData = entry as unknown as {
            _data?: { uncompressedSize?: number; compressedSize?: number };
          };
          return {
            path: cleanPath,
            name: baseName,
            size: internalData._data?.uncompressedSize ?? 0,
            compressedSize: internalData._data?.compressedSize ?? 0,
            isDir: entry.dir,
            category,
            mimeType,
          };
        });

        const visible = filterVisibleZipEntries(rawList);
        setZipEntries(visible);

        // Generate image thumbnails strictly for photos inside the ZIP
        const thumbs: Record<string, string> = {};
        for (const item of visible) {
          if (item.category === 'image') {
            const zEntry = zip.file(item.path);
            if (zEntry) {
              const bytes = await zEntry.async('uint8array');
              const copy = new Uint8Array(bytes.byteLength);
              copy.set(bytes);
              const blob = new Blob([copy.buffer], { type: item.mimeType });
              const url = URL.createObjectURL(blob);
              createdUrls.push(url);
              thumbs[item.path] = url;
            }
          }
        }
        if (!cancelled) {
          setZipThumbUrls(thumbs);
        }
      } catch {
        if (!cancelled) {
          setZipError(
            'Este archivero no pudo descomprimirse como un ZIP estándar.'
          );
        }
      } finally {
        if (!cancelled) setIsLoadingZip(false);
      }
    }

    parseZip();

    return () => {
      cancelled = true;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [mode, zipBytes]);

  async function handleOpenZipEntry(entry: ZipEntryItem) {
    if (!zipInstance) return;
    const zEntry = zipInstance.file(entry.path);
    if (!zEntry) return;
    const bytes = await zEntry.async('uint8array');

    if (entry.category === 'image') {
      const zipImages: FullscreenImageItem[] = [];
      let targetIdx = 0;
      for (const item of zipEntries) {
        if (item.category === 'image' && zipThumbUrls[item.path]) {
          if (item.path === entry.path) targetIdx = zipImages.length;
          zipImages.push({
            id: item.path,
            name: item.name,
            url: zipThumbUrls[item.path],
          });
        }
      }
      if (zipImages.length > 0) {
        onOpenFullscreenImages(zipImages, targetIdx);
      }
      return;
    }

    if (entry.category === 'audio') {
      onPlayExternalAudio(entry.name, entry.mimeType, bytes);
      return;
    }

    onOpenDocument({
      name: entry.name,
      mimeType: entry.mimeType,
      category: entry.category,
      size: bytes.byteLength,
      bytes,
    });
  }

  async function handleDownloadZipEntry(entry: ZipEntryItem) {
    if (!zipInstance) return;
    const zEntry = zipInstance.file(entry.path);
    if (!zEntry) return;
    const bytes = await zEntry.async('uint8array');
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: entry.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const title = mode === 'zip' ? zipFile?.name || 'Archivero ZIP' : folder?.name || 'Archivero';
  const count = mode === 'zip' ? zipEntries.length : folderFiles.length;

  return (
    <section
      aria-label={`Interior del archivero ${title}`}
      className="mx-auto max-w-7xl px-4 py-8 sm:px-8"
    >
      {/* Breadcrumb & Interior Header — strictly shows ONLY the archive and its internal files */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="liquid-glass-subtle inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/15 hover:text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver al casillero</span>
          </button>

          <div>
            <div className="flex items-center gap-2 text-xs text-slate-200/80 drop-shadow-[0_1px_6px_rgba(2,6,23,0.65)]">
              <span>Casillero</span>
              <span aria-hidden="true">/</span>
              <span>{mode === 'zip' ? 'Archivo ZIP' : 'Archivero'}</span>
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(2,6,23,0.65)]">
              {title}
            </h1>
            <p className="mt-0.5 text-xs text-slate-100/90 tabular-nums drop-shadow-[0_1px_6px_rgba(2,6,23,0.65)]">
              Mostrando únicamente el contenido interior · {count}{' '}
              {count === 1 ? 'archivo' : 'archivos'}
            </p>
          </div>
        </div>

        {mode === 'folder' && folder && onImportIntoFolder && (
          <button
            type="button"
            onClick={() => onImportIntoFolder(folder.id)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-medium text-slate-950 hover:bg-slate-100 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Agregar archivos aquí</span>
          </button>
        )}
      </div>

      {/* ZIP Interior Content */}
      {mode === 'zip' && (
        <>
          {isLoadingZip && (
            <div className="liquid-glass rounded-3xl p-12 text-center text-sm text-slate-300">
              Leyendo archivos dentro del paquete ZIP...
            </div>
          )}

          {zipError && (
            <div className="liquid-glass rounded-3xl p-10 text-center">
              <Archive
                className="mx-auto mb-3 h-8 w-8 text-slate-400"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-slate-200">{zipError}</p>
            </div>
          )}

          {!isLoadingZip && !zipError && zipEntries.length === 0 && (
            <div className="liquid-glass rounded-3xl p-12 text-center">
              <FolderOpen
                className="mx-auto mb-3 h-8 w-8 text-slate-400"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-300">
                Este archivo ZIP no contiene archivos visibles en su interior.
              </p>
            </div>
          )}

          {!isLoadingZip && !zipError && zipEntries.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {zipEntries.map((entry) => {
                const thumbUrl = zipThumbUrls[entry.path];
                return (
                  <article
                    key={entry.path}
                    className="liquid-glass group flex flex-col overflow-hidden rounded-2xl transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenZipEntry(entry)}
                      aria-label={`Abrir ${entry.name}`}
                      className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-950/60">
                        {entry.category === 'image' && thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={entry.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            {entry.category === 'audio' ? (
                              <Music className="h-8 w-8" aria-hidden="true" />
                            ) : entry.category === 'image' ? (
                              <ImageIcon className="h-8 w-8" aria-hidden="true" />
                            ) : (
                              <FileText className="h-8 w-8" aria-hidden="true" />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="truncate text-sm font-medium text-white">
                          {entry.name}
                        </h3>
                        <p className="mt-1 truncate text-xs text-slate-400 tabular-nums">
                          {categoryLabelEs(entry.category)}
                          {entry.size > 0 ? ` · ${formatBytes(entry.size)}` : ''}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-2.5">
                      <span className="truncate text-[11px] text-slate-400 max-w-[160px]">
                        {entry.path}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadZipEntry(entry)}
                        aria-label={`Extraer ${entry.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Custom Archivero (Folder) Interior Content */}
      {mode === 'folder' && (
        <>
          {folderFiles.length === 0 ? (
            <div className="liquid-glass rounded-3xl p-12 text-center">
              <FolderOpen
                className="mx-auto mb-3 h-8 w-8 text-slate-400"
                aria-hidden="true"
              />
              <h2 className="font-display text-base font-semibold text-white">
                Archivero vacío
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Importa fotografías o documentos directamente aquí para mantenerlos
                agrupados y cifrados.
              </p>
              {folder && onImportIntoFolder && (
                <button
                  type="button"
                  onClick={() => onImportIntoFolder(folder.id)}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-slate-950 hover:bg-slate-100"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Importar en este archivero</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {folderFiles.map((file) => {
                const thumbUrl = decryptedThumbnails[file.id];
                return (
                  <article
                    key={file.id}
                    className="liquid-glass group flex flex-col overflow-hidden rounded-2xl transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenVaultFile(file)}
                      aria-label={`Abrir ${file.name}`}
                      className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-950/60">
                        {file.category === 'image' && thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={file.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            {file.category === 'archive' ? (
                              <Archive className="h-8 w-8" aria-hidden="true" />
                            ) : file.category === 'audio' ? (
                              <Music className="h-8 w-8" aria-hidden="true" />
                            ) : (
                              <FileText className="h-8 w-8" aria-hidden="true" />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="truncate text-sm font-medium text-white">
                          {file.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-400 tabular-nums">
                          {categoryLabelEs(file.category)} · {formatBytes(file.size)}{' '}
                          · {formatShortDate(file.createdAt)}
                        </p>
                      </div>
                    </button>

                    {onDeleteVaultFile && (
                      <div className="flex items-center justify-end border-t border-white/[0.08] px-4 py-2">
                        <button
                          type="button"
                          onClick={() => onDeleteVaultFile(file)}
                          aria-label={`Eliminar ${file.name}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

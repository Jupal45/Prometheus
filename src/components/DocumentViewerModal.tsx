import { useEffect, useState } from 'react';
import { Download, FileText, File, X } from 'lucide-react';
import type { FileCategory } from '../types/vault';
import {
  categoryLabelEs,
  formatBytes,
  isTextReadable,
} from '../utils/fileClassification';

export interface DocumentViewerTarget {
  name: string;
  mimeType: string;
  category: FileCategory;
  size: number;
  sha256?: string;
  bytes: Uint8Array;
}

interface DocumentViewerModalProps {
  target: DocumentViewerTarget | null;
  onClose: () => void;
  onDownload: (target: DocumentViewerTarget) => void;
}

export function DocumentViewerModal({
  target,
  onClose,
  onDownload,
}: DocumentViewerModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setBlobUrl(null);
      setTextPreview(null);
      return;
    }

    const copy = new Uint8Array(target.bytes.byteLength);
    copy.set(target.bytes);
    const blob = new Blob([copy.buffer], {
      type: target.mimeType || 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    if (
      target.category === 'document' &&
      isTextReadable(target.name, target.mimeType)
    ) {
      try {
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(
          target.bytes.slice(0, 200_000)
        );
        setTextPreview(decoded);
      } catch {
        setTextPreview(null);
      }
    } else {
      setTextPreview(null);
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [target]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (target) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [target, onClose]);

  if (!target) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Visor de archivo: ${target.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md sm:p-8"
    >
      <div className="liquid-glass flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-semibold text-white">
              {target.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-300 tabular-nums">
              {categoryLabelEs(target.category)} · {formatBytes(target.size)}
              {target.mimeType ? ` · ${target.mimeType}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onDownload(target)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-medium text-slate-100 hover:bg-white/20 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Descargar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={`Cerrar visor de ${target.name}`}
              className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Viewer Body */}
        <div className="flex-1 overflow-auto bg-slate-950/45 p-4 sm:p-6">
          {target.category === 'pdf' && blobUrl && (
            <iframe
              title={target.name}
              src={blobUrl}
              className="h-full w-full rounded-2xl border border-white/10 bg-white"
            />
          )}

          {target.category === 'video' && blobUrl && (
            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-950/80 p-4">
              <video
                src={blobUrl}
                controls
                className="max-h-full max-w-full rounded-xl shadow-sm"
              />
            </div>
          )}

          {target.category === 'document' && textPreview !== null && (
            <pre className="mx-auto max-w-3xl whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/80 p-6 font-mono text-xs sm:text-sm leading-relaxed text-slate-100">
              {textPreview}
            </pre>
          )}

          {(target.category === 'other' ||
            (target.category === 'document' && textPreview === null)) && (
            <div className="flex h-full flex-col items-center justify-center text-center px-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-slate-200">
                {target.category === 'document' ? (
                  <FileText className="h-7 w-7" aria-hidden="true" />
                ) : (
                  <File className="h-7 w-7" aria-hidden="true" />
                )}
              </div>
              <h3 className="font-display text-lg font-semibold text-white">
                Archivo almacenado con cifrado completo
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-300 leading-relaxed">
                Este formato ({target.mimeType || 'binario'}) se conserva intacto
                dentro de tu casillero Prometheus. Puedes descargar una copia
                descifrada en cualquier momento.
              </p>
              {target.sha256 && (
                <p className="mt-4 max-w-md truncate font-mono text-[11px] text-slate-400">
                  SHA-256: {target.sha256}
                </p>
              )}
              <button
                type="button"
                onClick={() => onDownload(target)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Descargar archivo descifrado</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

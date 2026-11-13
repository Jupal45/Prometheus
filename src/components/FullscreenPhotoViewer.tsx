import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';

export interface FullscreenImageItem {
  id: string;
  name: string;
  url: string;
}

interface FullscreenPhotoViewerProps {
  images: FullscreenImageItem[];
  currentIndex: number;
  onChangeIndex: (nextIndex: number) => void;
  onClose: () => void;
  onDownload: (item: FullscreenImageItem) => void;
}

export function FullscreenPhotoViewer({
  images,
  currentIndex,
  onChangeIndex,
  onClose,
  onDownload,
}: FullscreenPhotoViewerProps) {
  // Default to full-bleed edge-to-edge coverage so the photo covers the entire screen as requested
  const [coverScreen, setCoverScreen] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);

  const current = images[currentIndex];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        onChangeIndex((currentIndex + 1) % images.length);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        onChangeIndex((currentIndex - 1 + images.length) % images.length);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, images.length, onChangeIndex, onClose]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Visor de pantalla completa: ${current.name}`}
      onMouseMove={() => setControlsVisible(true)}
      className="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-slate-950 select-none"
    >
      {/* Edge-to-edge full-screen image */}
      <img
        src={current.url}
        alt={current.name}
        referrerPolicy="no-referrer"
        onClick={() => setControlsVisible((v) => !v)}
        className={`h-screen w-screen transition-all duration-300 ${
          coverScreen ? 'object-cover' : 'object-contain bg-slate-950'
        }`}
      />

      {/* Top-right floating glass close & fit controls */}
      <div
        className={`fixed top-5 right-5 z-10 flex items-center gap-2 transition-opacity duration-200 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => setCoverScreen((prev) => !prev)}
          aria-label={
            coverScreen
              ? 'Ajustar imagen completa dentro de la pantalla'
              : 'Cubrir toda la pantalla con la imagen'
          }
          className="liquid-glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-100 hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {coverScreen ? (
            <>
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap">Ajustar</span>
            </>
          ) : (
            <>
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap">Cubrir pantalla</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onDownload(current)}
          aria-label={`Descargar ${current.name}`}
          className="liquid-glass inline-flex items-center justify-center rounded-xl p-2 text-slate-100 hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar visor de foto"
          className="liquid-glass inline-flex items-center justify-center rounded-xl p-2 text-white hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Bottom floating Liquid Glass caption & prev/next bar */}
      <div
        className={`fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-2xl liquid-glass px-4 py-2.5 transition-opacity duration-200 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {images.length > 1 && (
          <button
            type="button"
            onClick={() =>
              onChangeIndex((currentIndex - 1 + images.length) % images.length)
            }
            aria-label="Foto anterior"
            className="rounded-lg p-1.5 text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-300 max-w-[260px] sm:max-w-md">
          <span className="truncate font-medium text-white">
            {current.name}
          </span>
          {images.length > 1 && (
            <>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span className="tabular-nums text-slate-300 whitespace-nowrap">
                {currentIndex + 1} / {images.length}
              </span>
            </>
          )}
        </div>

        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onChangeIndex((currentIndex + 1) % images.length)}
            aria-label="Siguiente foto"
            className="rounded-lg p-1.5 text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

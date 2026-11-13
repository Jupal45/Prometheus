import { Music, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { formatDuration } from '../utils/fileClassification';
import type { ActiveAudioTrack } from './MusicPlaylistView';

interface MiniAudioPlayerProps {
  track: ActiveAudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenMusicView: () => void;
  onClosePlayer: () => void;
}

export function MiniAudioPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  onTogglePlayPause,
  onPrev,
  onNext,
  onOpenMusicView,
  onClosePlayer,
}: MiniAudioPlayerProps) {
  if (!track) return null;

  return (
    <aside
      aria-label="Reproductor de música en curso"
      className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2"
    >
      <div className="liquid-glass flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
        <button
          type="button"
          onClick={onOpenMusicView}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300">
            <Music className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">
              {track.name}
            </p>
            <p className="font-mono text-[11px] text-slate-400 tabular-nums">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Pista anterior"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <SkipBack className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onTogglePlayPause}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-950 hover:bg-slate-100"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5 translate-x-0.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            aria-label="Siguiente pista"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onClosePlayer}
            aria-label="Detener y cerrar reproductor"
            className="ml-1 rounded-lg p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

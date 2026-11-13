import { useState, type FormEvent } from 'react';
import {
  ListPlus,
  Music,
  Pause,
  Play,
  Plus,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
} from 'lucide-react';
import type { MusicPlaylist, VaultFileMeta } from '../types/vault';
import { formatBytes, formatDuration } from '../utils/fileClassification';

export interface ActiveAudioTrack {
  id: string;
  name: string;
  url: string;
}

interface MusicPlaylistViewProps {
  audioFiles: VaultFileMeta[];
  playlists: MusicPlaylist[];
  activePlaylistId: string;
  currentTrack: ActiveAudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: boolean;
  volume: number;
  onSelectPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onToggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
  onPlayTrack: (file: VaultFileMeta) => void;
  onTogglePlayPause: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (time: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onChangeVolume: (val: number) => void;
  onImportMusic: (targetPlaylistId: string) => void;
  onDeleteAudioFile: (file: VaultFileMeta) => void;
}

export function MusicPlaylistView({
  audioFiles,
  playlists,
  activePlaylistId,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  shuffle,
  repeat,
  volume,
  onSelectPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
  onToggleTrackInPlaylist,
  onPlayTrack,
  onTogglePlayPause,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onChangeVolume,
  onImportMusic,
  onDeleteAudioFile,
}: MusicPlaylistViewProps) {
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const activePlaylist =
    playlists.find((p) => p.id === activePlaylistId) ?? playlists[0];

  const playlistTracks = activePlaylist
    ? audioFiles.filter((f) => activePlaylist.trackIds.includes(f.id))
    : audioFiles;

  const otherTracks = activePlaylist
    ? audioFiles.filter((f) => !activePlaylist.trackIds.includes(f.id))
    : [];

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    onCreatePlaylist(trimmed);
    setNewPlaylistName('');
    setCreatingPlaylist(false);
  }

  return (
    <section
      aria-label="Música y playlists personales"
      className="mx-auto max-w-7xl px-4 py-8 sm:px-8 pb-28"
    >
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(2,6,23,0.65)]">
            Música personal
          </h1>
          <p className="mt-1 text-sm text-slate-100/90 drop-shadow-[0_1px_6px_rgba(2,6,23,0.65)]">
            Importa tus pistas de audio cifradas y organiza playlists
            tranquilas para escuchar en cualquier momento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCreatingPlaylist((v) => !v)}
            className="liquid-glass-subtle inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/15 hover:text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Nueva playlist</span>
          </button>

          <button
            type="button"
            onClick={() => onImportMusic(activePlaylist?.id || '')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-medium text-slate-950 hover:bg-slate-100 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Importar música</span>
          </button>
        </div>
      </div>

      {creatingPlaylist && (
        <form
          onSubmit={handleCreateSubmit}
          className="liquid-glass mb-7 flex flex-wrap items-center gap-3 rounded-2xl p-4"
        >
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="Nombre de tu playlist (ej. Noche tranquila)"
            aria-label="Nombre de la nueva playlist"
            autoFocus
            className="flex-1 min-w-[220px] rounded-xl border border-white/15 bg-slate-950/65 px-3.5 py-2 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-white px-4 py-2 text-xs font-medium text-slate-950 hover:bg-slate-100 whitespace-nowrap"
          >
            Crear playlist
          </button>
          <button
            type="button"
            onClick={() => setCreatingPlaylist(false)}
            className="rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:text-white whitespace-nowrap"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Playlist Selector Tabs */}
      {playlists.length > 0 && (
        <div className="mb-7 flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Tus playlists"
            className="liquid-glass-pill-bar inline-flex flex-wrap items-center gap-1 rounded-xl p-1"
          >
            {playlists.map((pl) => {
              const selected = activePlaylist?.id === pl.id;
              return (
                <button
                  key={pl.id}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => onSelectPlaylist(pl.id)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                    selected
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {pl.name}
                </button>
              );
            })}
          </div>

          {activePlaylist && playlists.length > 1 && (
            <button
              type="button"
              onClick={() => onDeletePlaylist(activePlaylist.id)}
              aria-label={`Eliminar playlist ${activePlaylist.name}`}
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Main Split: Player Console + Playlist Track List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left: Calm Glass Player Card */}
        <div className="liquid-glass rounded-3xl p-6 sm:p-7 lg:col-span-5">
          <div className="mb-6 flex aspect-[4/3] w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-sky-950/45 via-slate-900/75 to-slate-950/85 border border-white/[0.08]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 shadow-sm text-sky-300">
              <Music className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="mt-4 px-6 text-center font-display text-base font-semibold text-white truncate max-w-full">
              {currentTrack?.name ||
                playlistTracks[0]?.name ||
                'Sin pista seleccionada'}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {activePlaylist?.name || 'Biblioteca'}
            </p>
          </div>

          {/* Scrubber */}
          <div className="mb-5">
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              value={duration > 0 ? currentTime : 0}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Progreso de reproducción"
              disabled={!currentTrack}
              className="w-full accent-sky-400 cursor-pointer disabled:opacity-40"
            />
            <div className="mt-1.5 flex justify-between font-mono text-[11px] text-slate-400 tabular-nums">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onToggleShuffle}
              aria-label="Reproducción aleatoria"
              aria-pressed={shuffle}
              className={`rounded-xl p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                shuffle
                  ? 'bg-sky-400/20 text-sky-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shuffle className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onPrevTrack}
                aria-label="Pista anterior"
                disabled={playlistTracks.length === 0}
                className="rounded-xl p-2.5 text-slate-200 hover:bg-white/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <SkipBack className="h-5 w-5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!currentTrack && playlistTracks[0]) {
                    onPlayTrack(playlistTracks[0]);
                  } else {
                    onTogglePlayPause();
                  }
                }}
                aria-label={isPlaying ? 'Pausar música' : 'Reproducir música'}
                disabled={playlistTracks.length === 0 && !currentTrack}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-950 shadow-sm hover:bg-slate-100 disabled:opacity-40 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Play className="h-5 w-5 translate-x-0.5" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={onNextTrack}
                aria-label="Siguiente pista"
                disabled={playlistTracks.length === 0}
                className="rounded-xl p-2.5 text-slate-200 hover:bg-white/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <SkipForward className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleRepeat}
              aria-label="Repetir pista"
              aria-pressed={repeat}
              className={`rounded-xl p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                repeat
                  ? 'bg-sky-400/20 text-sky-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Repeat className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Volume */}
          <div className="mt-6 flex items-center gap-3 border-t border-white/[0.08] pt-4">
            <Volume2 className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={(e) => onChangeVolume(Number(e.target.value))}
              aria-label="Volumen"
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Right: Playlist Tracks */}
        <div className="liquid-glass rounded-3xl p-6 sm:p-7 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h2 className="font-display text-base font-semibold text-white">
              {activePlaylist?.name || 'Pistas'}
            </h2>
            <span className="text-xs text-slate-400 tabular-nums">
              {playlistTracks.length}{' '}
              {playlistTracks.length === 1 ? 'pista' : 'pistas'}
            </span>
          </div>

          {playlistTracks.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-300">
                Esta playlist aún no tiene pistas.
              </p>
              <button
                type="button"
                onClick={() => onImportMusic(activePlaylist?.id || '')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-medium text-slate-950 hover:bg-slate-100"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Importar canciones (.mp3, .wav, .ogg)</span>
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.07]">
              {playlistTracks.map((track, idx) => {
                const active = currentTrack?.id === track.id;
                return (
                  <li
                    key={track.id}
                    className={`flex items-center justify-between gap-3 py-3 transition-colors ${
                      active ? 'text-sky-300' : 'text-slate-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        active ? onTogglePlayPause() : onPlayTrack(track)
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-slate-200 font-mono text-xs tabular-nums">
                        {active && isPlaying ? (
                          <Pause className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                        ) : active ? (
                          <Play className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm ${
                            active ? 'font-semibold text-sky-300' : 'font-medium text-white'
                          }`}
                        >
                          {track.name}
                        </p>
                        <p className="text-xs text-slate-400 tabular-nums">
                          {formatBytes(track.size)}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {activePlaylist && (
                        <button
                          type="button"
                          onClick={() =>
                            onToggleTrackInPlaylist(activePlaylist.id, track.id)
                          }
                          aria-label={`Quitar ${track.name} de la playlist`}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:bg-white/10 hover:text-white"
                        >
                          Quitar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteAudioFile(track)}
                        aria-label={`Eliminar archivo ${track.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Other audio files in vault that can be added to this playlist */}
          {activePlaylist && otherTracks.length > 0 && (
            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <h3 className="mb-3 text-xs font-medium text-slate-300">
                Otras pistas disponibles en tu casillero
              </h3>
              <ul className="space-y-2">
                {otherTracks.map((track) => (
                  <li
                    key={track.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.06] px-3.5 py-2"
                  >
                    <span className="truncate text-xs font-medium text-slate-200">
                      {track.name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onToggleTrackInPlaylist(activePlaylist.id, track.id)
                      }
                      className="text-xs font-medium text-sky-300 hover:text-sky-200 whitespace-nowrap"
                    >
                      + Agregar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

import { useState, type FormEvent } from 'react';
import {
  Archive,
  File,
  FileText,
  Film,
  FolderPlus,
  Lock,
  Music,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  GalleryFilter,
  VaultFileMeta,
  VaultFolder,
} from '../types/vault';
import {
  categoryLabelEs,
  filterGalleryFiles,
  formatBytes,
  formatShortDate,
} from '../utils/fileClassification';

interface GalleryGridProps {
  files: VaultFileMeta[];
  folders: VaultFolder[];
  decryptedThumbnails: Record<string, string>;
  activeFilter: GalleryFilter;
  archivesOnlySection?: boolean;
  onChangeFilter: (filter: GalleryFilter) => void;
  onOpenFile: (file: VaultFileMeta) => void;
  onOpenFolder: (folder: VaultFolder) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFile: (file: VaultFileMeta) => void;
  onDeleteFolder: (folder: VaultFolder) => void;
  onTriggerImport: () => void;
  onLockVault: () => void;
}

const FILTER_TABS: { id: GalleryFilter; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'image', label: 'Fotos' },
  { id: 'document', label: 'Documentos' },
  { id: 'archive', label: 'Archiveros' },
];

export function GalleryGrid({
  files,
  folders,
  decryptedThumbnails,
  activeFilter,
  archivesOnlySection = false,
  onChangeFilter,
  onOpenFile,
  onOpenFolder,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onTriggerImport,
  onLockVault,
}: GalleryGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const effectiveFilter: GalleryFilter = archivesOnlySection
    ? 'archive'
    : activeFilter;

  const filteredFiles = filterGalleryFiles(files, effectiveFilter, searchQuery);
  const filteredFolders =
    effectiveFilter === 'all' || effectiveFilter === 'archive'
      ? folders.filter((f) =>
          f.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
        )
      : [];

  function handleCreateFolderSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    onCreateFolder(trimmed);
    setNewFolderName('');
    setCreatingFolder(false);
  }

  const totalCount = filteredFiles.length + filteredFolders.length;

  return (
    <section
      aria-label={archivesOnlySection ? 'Archiveros privados' : 'Galería del casillero'}
      className="mx-auto max-w-7xl px-4 py-8 sm:px-8"
    >
      {/* Serene Workspace Header & Toolbar */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(2,6,23,0.65)]">
            {archivesOnlySection ? 'Archiveros' : 'Tu casillero privado'}
          </h1>
          <p className="mt-1 text-sm text-slate-100/90 drop-shadow-[0_1px_6px_rgba(2,6,23,0.65)]">
            {archivesOnlySection
              ? 'Los paquetes ZIP y archiveros muestran únicamente los archivos en su interior.'
              : 'Visualiza fotografías a pantalla completa, lee documentos o abre archiveros ZIP.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar archivo..."
              aria-label="Buscar archivo en el casillero"
              className="liquid-glass-subtle w-48 sm:w-56 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25"
            />
          </div>

          <button
            type="button"
            onClick={() => setCreatingFolder((v) => !v)}
            className="liquid-glass-subtle inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/15 hover:text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Nuevo archivero</span>
          </button>

          <button
            type="button"
            onClick={onLockVault}
            className="liquid-glass-subtle inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/15 hover:text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Bloquear</span>
          </button>
        </div>
      </div>

      {/* Optional inline form to create a new Archivero */}
      {creatingFolder && (
        <form
          onSubmit={handleCreateFolderSubmit}
          className="liquid-glass mb-7 flex flex-wrap items-center gap-3 rounded-2xl p-4"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nombre del nuevo archivero (ej. Recuerdos 2026)"
            aria-label="Nombre del nuevo archivero"
            autoFocus
            className="flex-1 min-w-[220px] rounded-xl border border-white/15 bg-slate-950/65 px-3.5 py-2 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-white px-4 py-2 text-xs font-medium text-slate-950 hover:bg-slate-100 whitespace-nowrap"
          >
            Crear archivero
          </button>
          <button
            type="button"
            onClick={() => setCreatingFolder(false)}
            className="rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:text-white whitespace-nowrap"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Segmented Category Filter Bar (when in main Galería) */}
      {!archivesOnlySection && (
        <div className="mb-7 flex items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Filtrar archivos por tipo"
            className="liquid-glass-pill-bar inline-flex items-center gap-1 rounded-xl p-1"
          >
            {FILTER_TABS.map((tab) => {
              const selected = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => onChangeFilter(tab.id)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    selected
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <p className="hidden sm:block text-xs text-slate-100/90 tabular-nums drop-shadow-[0_1px_6px_rgba(2,6,23,0.65)]">
            {totalCount} {totalCount === 1 ? 'elemento' : 'elementos'}
          </p>
        </div>
      )}

      {/* Empty State */}
      {totalCount === 0 ? (
        <div className="liquid-glass flex flex-col items-center justify-center rounded-3xl px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.08] text-slate-300">
            <Archive className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="font-display text-lg font-semibold text-white">
            {searchQuery
              ? 'No hay coincidencias'
              : 'Este espacio está listo para tus archivos'}
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-slate-300">
            {searchQuery
              ? 'Prueba con otro término de búsqueda o cambia el filtro.'
              : 'Arrastra aquí fotografías, documentos PDF, archiveros ZIP o música. Todo se cifra al instante en tu dispositivo.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={onTriggerImport}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-medium text-slate-950 hover:bg-slate-100 transition-colors"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Importar primer archivo</span>
            </button>
          )}
        </div>
      ) : (
        /* Unified Gallery Grid */
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Custom Archiveros */}
          {filteredFolders.map((folder) => {
            const innerCount = files.filter((f) => f.folderId === folder.id).length;
            return (
              <article
                key={folder.id}
                className="liquid-glass group flex flex-col overflow-hidden rounded-2xl transition-transform duration-200 hover:-translate-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => onOpenFolder(folder)}
                  aria-label={`Abrir archivero ${folder.name}`}
                  className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
                >
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center bg-gradient-to-br from-sky-950/50 via-slate-900/70 to-slate-950/80 text-sky-300">
                    <Archive className="h-10 w-10 stroke-[1.5]" aria-hidden="true" />
                    <span className="mt-2.5 text-xs font-medium text-slate-300 tabular-nums">
                      {innerCount}{' '}
                      {innerCount === 1 ? 'archivo interior' : 'archivos interiores'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="truncate font-display text-sm font-semibold text-white">
                      {folder.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 tabular-nums">
                      Archivero · {formatShortDate(folder.createdAt)}
                    </p>
                  </div>
                </button>

                <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-2">
                  <span className="text-[11px] text-slate-400">
                    Abrir contenido interior
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteFolder(folder)}
                    aria-label={`Eliminar archivero ${folder.name}`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}

          {/* Root Vault Files */}
          {filteredFiles.map((file) => {
            const thumbUrl = decryptedThumbnails[file.id];
            return (
              <article
                key={file.id}
                className="liquid-glass group flex flex-col overflow-hidden rounded-2xl transition-transform duration-200 hover:-translate-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => onOpenFile(file)}
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
                      <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                        {file.category === 'archive' ? (
                          <>
                            <Archive
                              className="h-9 w-9 text-sky-300 stroke-[1.5]"
                              aria-hidden="true"
                            />
                            <span className="mt-2 text-[11px] font-medium text-slate-300">
                              Ver contenido ZIP
                            </span>
                          </>
                        ) : file.category === 'pdf' ||
                          file.category === 'document' ? (
                          <FileText
                            className="h-9 w-9 stroke-[1.5]"
                            aria-hidden="true"
                          />
                        ) : file.category === 'audio' ? (
                          <Music
                            className="h-9 w-9 stroke-[1.5]"
                            aria-hidden="true"
                          />
                        ) : file.category === 'video' ? (
                          <Film
                            className="h-9 w-9 stroke-[1.5]"
                            aria-hidden="true"
                          />
                        ) : (
                          <File
                            className="h-9 w-9 stroke-[1.5]"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="truncate font-display text-sm font-medium text-white">
                      {file.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 tabular-nums">
                      {categoryLabelEs(file.category)} · {formatBytes(file.size)}{' '}
                      · {formatShortDate(file.createdAt)}
                    </p>
                  </div>
                </button>

                <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-2">
                  <span className="text-[11px] text-slate-400">
                    {file.category === 'image'
                      ? 'Ver a pantalla completa'
                      : file.category === 'archive'
                      ? 'Explorar interior'
                      : file.category === 'audio'
                      ? 'Reproducir pista'
                      : 'Abrir archivo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteFile(file)}
                    aria-label={`Eliminar ${file.name}`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

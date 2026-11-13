import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { Upload } from 'lucide-react';
import type {
  AppSection,
  GalleryFilter,
  MusicPlaylist,
  VaultFileMeta,
  VaultFolder,
  VaultManifest,
  VaultSecurityConfig,
} from './types/vault';
import { isZipArchive } from './utils/fileClassification';
import { buildVaultBackupZip, parseVaultBackupZip } from './utils/backup';
import { getNextTrackIndex } from './utils/vaultState';
import {
  createNewVault,
  createOrUnlockDemoVault,
  getSecurityConfig,
  readDecryptedFile,
  removeEncryptedFile,
  saveManifest,
  storeEncryptedFile,
  wipeEntireVault,
} from './utils/vaultStorage';
import { LiquidGlassBackground } from './components/LiquidGlassBackground';
import { IntroSplash } from './components/IntroSplash';
import { AuthGate } from './components/AuthGate';
import { TopNav } from './components/TopNav';
import { GalleryGrid } from './components/GalleryGrid';
import { ArchiveView } from './components/ArchiveView';
import {
  FullscreenPhotoViewer,
  type FullscreenImageItem,
} from './components/FullscreenPhotoViewer';
import {
  DocumentViewerModal,
  type DocumentViewerTarget,
} from './components/DocumentViewerModal';
import {
  MusicPlaylistView,
  type ActiveAudioTrack,
} from './components/MusicPlaylistView';
import { MiniAudioPlayer } from './components/MiniAudioPlayer';
import { SecurityView } from './components/SecurityView';

type OpenArchiveState =
  | { kind: 'zip'; file: VaultFileMeta; bytes: Uint8Array }
  | { kind: 'folder'; folder: VaultFolder };

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [showSplash, setShowSplash] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') !== '1';
  });
  const [securityConfig, setSecurityConfig] =
    useState<VaultSecurityConfig | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [manifest, setManifest] = useState<VaultManifest | null>(null);

  const [activeSection, setActiveSection] = useState<AppSection>('gallery');
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>('all');
  const [openArchive, setOpenArchive] = useState<OpenArchiveState | null>(null);

  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const thumbnailsRef = useRef<Record<string, string>>({});

  // Fullscreen photo viewer state
  const [fullscreenImages, setFullscreenImages] = useState<
    FullscreenImageItem[]
  >([]);
  const [fullscreenIndex, setFullscreenIndex] = useState<number>(0);

  // Document / PDF / binary viewer modal state
  const [docTarget, setDocTarget] = useState<DocumentViewerTarget | null>(null);

  // Drag-and-drop and file picker state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImportTargetRef = useRef<{
    folderId: string | null;
    playlistId: string | null;
  }>({ folderId: null, playlistId: null });

  // Music player state
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string>('');
  const [currentTrack, setCurrentTrack] = useState<ActiveAudioTrack | null>(
    null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [volume, setVolume] = useState(0.85);

  const revokeAllThumbnails = useCallback(() => {
    Object.values(thumbnailsRef.current).forEach((url) =>
      URL.revokeObjectURL(url)
    );
    thumbnailsRef.current = {};
    setThumbnails({});
  }, []);

  // Boot check + ?autostart=1 support
  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const params = new URLSearchParams(window.location.search);
        const autostart = params.get('autostart') === '1';
        if (autostart) {
          const unlocked = await createOrUnlockDemoVault();
          if (!active) return;
          setSecurityConfig(unlocked.config);
          setMasterKey(unlocked.key);
          setManifest(unlocked.manifest);
          setActivePlaylistId(unlocked.manifest.playlists[0]?.id || '');
        } else {
          const existing = await getSecurityConfig();
          if (!active) return;
          setSecurityConfig(existing);
        }
      } catch {
        if (active) setSecurityConfig(null);
      } finally {
        if (active) setInitializing(false);
      }
    }
    boot();
    const splashTimer = showSplash
      ? window.setTimeout(() => {
          if (active) setShowSplash(false);
        }, 1450)
      : undefined;
    return () => {
      active = false;
      if (splashTimer !== undefined) window.clearTimeout(splashTimer);
    };
  }, []);

  // Decrypt image thumbnails lazily when manifest or key changes
  useEffect(() => {
    if (!masterKey || !manifest) return;
    let cancelled = false;

    async function decryptMissingThumbnails() {
      if (!masterKey || !manifest) return;
      const imageFiles = manifest.files.filter((f) => f.category === 'image');
      const nextMap: Record<string, string> = { ...thumbnailsRef.current };
      let updated = false;

      for (const file of imageFiles) {
        if (cancelled) return;
        if (nextMap[file.id]) continue;
        try {
          const bytes = await readDecryptedFile(masterKey, file.id);
          if (cancelled) return;
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);
          const blob = new Blob([copy.buffer], { type: file.mimeType });
          nextMap[file.id] = URL.createObjectURL(blob);
          updated = true;
        } catch {
          // Ignore individual unreadable entry
        }
      }

      if (updated && !cancelled) {
        thumbnailsRef.current = nextMap;
        setThumbnails({ ...nextMap });
      }
    }

    decryptMissingThumbnails();

    return () => {
      cancelled = true;
    };
  }, [masterKey, manifest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revokeAllThumbnails();
    };
  }, [revokeAllThumbnails]);

  const handleLockVault = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
    }
    if (currentTrack?.url) {
      URL.revokeObjectURL(currentTrack.url);
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setFullscreenImages([]);
    setDocTarget(null);
    setOpenArchive(null);
    setActiveSection('gallery');
    setGalleryFilter('all');
    revokeAllThumbnails();
    setMasterKey(null);
    setManifest(null);
  }, [currentTrack, revokeAllThumbnails]);

  const audioFiles = useMemo(
    () => (manifest ? manifest.files.filter((f) => f.category === 'audio') : []),
    [manifest]
  );

  const playVaultAudioFile = useCallback(
    async (file: VaultFileMeta) => {
      if (!masterKey) return;
      try {
        const bytes = await readDecryptedFile(masterKey, file.id);
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        const blob = new Blob([copy.buffer], { type: file.mimeType });
        const url = URL.createObjectURL(blob);

        setCurrentTrack((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return { id: file.id, name: file.name, url };
        });

        const audio = audioElRef.current;
        if (audio) {
          audio.src = url;
          audio.volume = volume;
          await audio.play();
          setIsPlaying(true);
        }
      } catch {
        setImportNotice('No se pudo reproducir la pista de audio.');
      }
    },
    [masterKey, volume]
  );

  const playExternalAudioBytes = useCallback(
    async (name: string, mimeType: string, bytes: Uint8Array) => {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const blob = new Blob([copy.buffer], { type: mimeType || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      setCurrentTrack((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { id: `zip-${name}`, name, url };
      });
      const audio = audioElRef.current;
      if (audio) {
        audio.src = url;
        audio.volume = volume;
        await audio.play().catch(() => {});
        setIsPlaying(true);
      }
    },
    [volume]
  );

  const handleNextOrPrevTrack = useCallback(
    (direction: 'next' | 'prev') => {
      if (!manifest) return;
      const activePl =
        manifest.playlists.find((p) => p.id === activePlaylistId) ??
        manifest.playlists[0];
      const tracks = activePl
        ? audioFiles.filter((f) => activePl.trackIds.includes(f.id))
        : audioFiles;
      if (tracks.length === 0) return;
      const curIdx = currentTrack
        ? tracks.findIndex((t) => t.id === currentTrack.id)
        : -1;
      const nextIdx = getNextTrackIndex(
        curIdx < 0 ? 0 : curIdx,
        tracks.length,
        direction,
        shuffle
      );
      if (nextIdx >= 0 && tracks[nextIdx]) {
        playVaultAudioFile(tracks[nextIdx]);
      }
    },
    [activePlaylistId, audioFiles, currentTrack, manifest, playVaultAudioFile, shuffle]
  );

  // Open a file from the vault
  const handleOpenVaultFile = useCallback(
    async (file: VaultFileMeta) => {
      if (!masterKey || !manifest) return;

      // 1. Photos -> edge-to-edge full screen gallery
      if (file.category === 'image') {
        const scopeFiles =
          openArchive?.kind === 'folder'
            ? manifest.files.filter(
                (f) => f.folderId === openArchive.folder.id && f.category === 'image'
              )
            : manifest.files.filter(
                (f) => f.folderId === null && f.category === 'image'
              );

        const items: FullscreenImageItem[] = [];
        let startIdx = 0;
        for (const img of scopeFiles) {
          let url = thumbnailsRef.current[img.id];
          if (!url) {
            const bytes = await readDecryptedFile(masterKey, img.id);
            const copy = new Uint8Array(bytes.byteLength);
            copy.set(bytes);
            url = URL.createObjectURL(
              new Blob([copy.buffer], { type: img.mimeType })
            );
            thumbnailsRef.current[img.id] = url;
            setThumbnails({ ...thumbnailsRef.current });
          }
          if (img.id === file.id) startIdx = items.length;
          items.push({ id: img.id, name: img.name, url });
        }
        setFullscreenImages(items);
        setFullscreenIndex(startIdx);
        return;
      }

      // 2. ZIP / Archive -> exclusively display files inside it
      if (file.category === 'archive' && isZipArchive(file.name, file.mimeType)) {
        const bytes = await readDecryptedFile(masterKey, file.id);
        setOpenArchive({ kind: 'zip', file, bytes });
        return;
      }

      // 3. Audio -> play in custom music player
      if (file.category === 'audio') {
        await playVaultAudioFile(file);
        return;
      }

      // 4. PDF, Document, Video, or any other arbitrary format -> clean modal viewer
      const bytes = await readDecryptedFile(masterKey, file.id);
      setDocTarget({
        name: file.name,
        mimeType: file.mimeType,
        category: file.category,
        size: file.size,
        sha256: file.sha256,
        bytes,
      });
    },
    [manifest, masterKey, openArchive, playVaultAudioFile]
  );

  // Import files (any format)
  const importSelectedFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (!masterKey || !manifest) return;
      const filesArr = Array.from(fileList);
      if (filesArr.length === 0) return;

      const targetFolderId = pendingImportTargetRef.current.folderId;
      const targetPlaylistId = pendingImportTargetRef.current.playlistId;
      pendingImportTargetRef.current = { folderId: null, playlistId: null };

      setIsImporting(true);
      setImportNotice(null);
      try {
        const addedMeta: VaultFileMeta[] = [];
        for (const f of filesArr) {
          const buf = await f.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const meta = await storeEncryptedFile(
            masterKey,
            f.name,
            bytes,
            f.type || 'application/octet-stream',
            targetFolderId
          );
          addedMeta.push(meta);
        }

        const addedAudioIds = addedMeta
          .filter((m) => m.category === 'audio')
          .map((m) => m.id);

        const nextPlaylists = manifest.playlists.map((pl, idx) => {
          const shouldAppend =
            (targetPlaylistId && pl.id === targetPlaylistId) ||
            (!targetPlaylistId && idx === 0);
          if (!shouldAppend || addedAudioIds.length === 0) return pl;
          return {
            ...pl,
            trackIds: [...pl.trackIds, ...addedAudioIds],
          };
        });

        const nextManifest: VaultManifest = {
          ...manifest,
          files: [...addedMeta, ...manifest.files],
          playlists: nextPlaylists,
        };
        await saveManifest(masterKey, nextManifest);
        setManifest(nextManifest);

        if (targetPlaylistId && addedAudioIds.length === 0) {
          setImportNotice(
            'Archivo guardado en tu casillero. Para añadirlo a la playlist selecciona archivos de audio (.mp3, .wav, .m4a, .ogg).'
          );
        } else {
          setImportNotice(
            addedMeta.length === 1
              ? `"${addedMeta[0].name}" cifrado y guardado en tu casillero.`
              : `${addedMeta.length} archivos cifrados y guardados en tu casillero.`
          );
        }
      } catch {
        setImportNotice('Ocurrió un error al cifrar e importar los archivos.');
      } finally {
        setIsImporting(false);
      }
    },
    [manifest, masterKey]
  );

  function triggerFilePicker(options?: {
    folderId?: string | null;
    playlistId?: string | null;
    acceptAudio?: boolean;
  }) {
    pendingImportTargetRef.current = {
      folderId: options?.folderId ?? null,
      playlistId: options?.playlistId ?? null,
    };
    if (fileInputRef.current) {
      // Remove accept restriction so mobile & desktop file managers ("Mis archivos")
      // always show .mp3 alongside all other audio and file formats without hiding them behind MP4-only filters.
      fileInputRef.current.removeAttribute('accept');
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleCreateFolder(name: string) {
    if (!masterKey || !manifest) return;
    const newFolder: VaultFolder = {
      id: globalThis.crypto.randomUUID(),
      name,
      description: 'Archivero privado cifrado',
      createdAt: Date.now(),
    };
    const nextManifest: VaultManifest = {
      ...manifest,
      folders: [newFolder, ...manifest.folders],
    };
    await saveManifest(masterKey, nextManifest);
    setManifest(nextManifest);
  }

  async function handleDeleteFile(file: VaultFileMeta) {
    if (!masterKey || !manifest) return;
    await removeEncryptedFile(file.id);
    if (thumbnailsRef.current[file.id]) {
      URL.revokeObjectURL(thumbnailsRef.current[file.id]);
      delete thumbnailsRef.current[file.id];
      setThumbnails({ ...thumbnailsRef.current });
    }
    if (currentTrack?.id === file.id) {
      audioElRef.current?.pause();
      if (currentTrack.url) URL.revokeObjectURL(currentTrack.url);
      setCurrentTrack(null);
      setIsPlaying(false);
    }
    const nextManifest: VaultManifest = {
      ...manifest,
      files: manifest.files.filter((f) => f.id !== file.id),
      playlists: manifest.playlists.map((pl) => ({
        ...pl,
        trackIds: pl.trackIds.filter((tid) => tid !== file.id),
      })),
    };
    await saveManifest(masterKey, nextManifest);
    setManifest(nextManifest);
  }

  async function handleDeleteFolder(folder: VaultFolder) {
    if (!masterKey || !manifest) return;
    const insideFiles = manifest.files.filter((f) => f.folderId === folder.id);
    for (const f of insideFiles) {
      await removeEncryptedFile(f.id);
    }
    const nextManifest: VaultManifest = {
      ...manifest,
      folders: manifest.folders.filter((fl) => fl.id !== folder.id),
      files: manifest.files.filter((f) => f.folderId !== folder.id),
    };
    await saveManifest(masterKey, nextManifest);
    setManifest(nextManifest);
    if (openArchive?.kind === 'folder' && openArchive.folder.id === folder.id) {
      setOpenArchive(null);
    }
  }

  async function handleCreatePlaylist(name: string) {
    if (!masterKey || !manifest) return;
    const newPl: MusicPlaylist = {
      id: globalThis.crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      trackIds: [],
    };
    const nextManifest: VaultManifest = {
      ...manifest,
      playlists: [...manifest.playlists, newPl],
    };
    await saveManifest(masterKey, nextManifest);
    setManifest(nextManifest);
    setActivePlaylistId(newPl.id);
  }

  async function handleDeletePlaylist(playlistId: string) {
    if (!masterKey || !manifest || manifest.playlists.length <= 1) return;
    const remaining = manifest.playlists.filter((p) => p.id !== playlistId);
    const nextManifest: VaultManifest = {
      ...manifest,
      playlists: remaining,
    };
    await saveManifest(masterKey, nextManifest);
    setManifest(nextManifest);
    if (activePlaylistId === playlistId) {
      setActivePlaylistId(remaining[0]?.id || '');
    }
  }

  async function handleToggleTrackInPlaylist(playlistId: string, trackId: string) {
    if (!masterKey || !manifest) return;
    const nextPlaylists = manifest.playlists.map((pl) => {
      if (pl.id !== playlistId) return pl;
      const exists = pl.trackIds.includes(trackId);
      return {
        ...pl,
        trackIds: exists
          ? pl.trackIds.filter((id) => id !== trackId)
          : [...pl.trackIds, trackId],
      };
    });
    const nextManifest: VaultManifest = {
      ...manifest,
      playlists: nextPlaylists,
    };
    await saveManifest(masterKey, nextManifest);
    setManifest(nextManifest);
  }

  async function handleUpdateCredentials(params: {
    phase1Password: string;
    phase2Pin: string;
    phase3Key: string;
    phase3Prompt: string;
  }) {
    if (!masterKey || !manifest) return;
    // Decrypt all existing files in memory before re-encrypting under new 3-phase key
    const decryptedFiles: { meta: VaultFileMeta; bytes: Uint8Array }[] = [];
    for (const file of manifest.files) {
      const bytes = await readDecryptedFile(masterKey, file.id);
      decryptedFiles.push({ meta: file, bytes });
    }

    const savedFolders = manifest.folders;
    const savedPlaylists = manifest.playlists;

    await wipeEntireVault();
    const fresh = await createNewVault({
      phase1Password: params.phase1Password,
      phase2Pin: params.phase2Pin,
      phase3Key: params.phase3Key,
      phase3Prompt: params.phase3Prompt,
      seedStarterContent: false,
    });

    const newFiles: VaultFileMeta[] = [];
    const oldToNewId: Record<string, string> = {};
    for (const item of decryptedFiles) {
      const stored = await storeEncryptedFile(
        fresh.key,
        item.meta.name,
        item.bytes,
        item.meta.mimeType,
        item.meta.folderId
      );
      oldToNewId[item.meta.id] = stored.id;
      newFiles.push(stored);
    }

    const updatedManifest: VaultManifest = {
      version: 1,
      files: newFiles,
      folders: savedFolders,
      playlists: savedPlaylists.map((pl) => ({
        ...pl,
        trackIds: pl.trackIds.map((id) => oldToNewId[id] || id),
      })),
    };

    await saveManifest(fresh.key, updatedManifest);
    setSecurityConfig(fresh.config);
    setMasterKey(fresh.key);
    setManifest(updatedManifest);
  }

  async function handleExportBackup() {
    if (!masterKey || !manifest) return;
    const zipBytes = await buildVaultBackupZip(manifest, (fileId) =>
      readDecryptedFile(masterKey, fileId)
    );
    const copy = new Uint8Array(zipBytes.byteLength);
    copy.set(zipBytes);
    const blob = new Blob([copy.buffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Prometheus-Respaldo-${dateStamp}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function handleRestoreBackup(file: File): Promise<number> {
    if (!masterKey || !manifest) return 0;
    const buf = await file.arrayBuffer();
    const parsed = await parseVaultBackupZip(new Uint8Array(buf));

    const existingFolderIds = new Set(manifest.folders.map((f) => f.id));
    const folderIdMap: Record<string, string> = {};
    const mergedFolders: VaultFolder[] = [...manifest.folders];

    for (const folder of parsed.folders) {
      if (existingFolderIds.has(folder.id)) {
        folderIdMap[folder.id] = folder.id;
      } else {
        const newId = globalThis.crypto.randomUUID();
        folderIdMap[folder.id] = newId;
        mergedFolders.push({ ...folder, id: newId });
      }
    }

    const oldToNewFileId: Record<string, string> = {};
    const restoredMetas: VaultFileMeta[] = [];

    for (const item of parsed.files) {
      const targetFolder = item.entry.folderId
        ? folderIdMap[item.entry.folderId] ?? null
        : null;
      const stored = await storeEncryptedFile(
        masterKey,
        item.entry.name,
        item.bytes,
        item.entry.mimeType,
        targetFolder
      );
      oldToNewFileId[item.entry.originalId] = stored.id;
      restoredMetas.push(stored);
    }

    const mergedPlaylists: MusicPlaylist[] = [...manifest.playlists];
    for (const pl of parsed.playlists) {
      const mappedTracks = pl.trackIds
        .map((id) => oldToNewFileId[id])
        .filter(Boolean);
      const existingIdx = mergedPlaylists.findIndex(
        (cur) => cur.name.toLowerCase() === pl.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        const cur = mergedPlaylists[existingIdx];
        const unique = Array.from(new Set([...cur.trackIds, ...mappedTracks]));
        mergedPlaylists[existingIdx] = { ...cur, trackIds: unique };
      } else {
        mergedPlaylists.push({
          id: globalThis.crypto.randomUUID(),
          name: pl.name,
          createdAt: pl.createdAt || Date.now(),
          trackIds: mappedTracks,
        });
      }
    }

    const nextManifest: VaultManifest = {
      version: 1,
      files: [...restoredMetas, ...manifest.files],
      folders: mergedFolders,
      playlists: mergedPlaylists,
    };

    await saveManifest(masterKey, nextManifest);
    setManifest(nextManifest);
    return restoredMetas.length;
  }

  async function handleWipeAndReset() {
    handleLockVault();
    await wipeEntireVault();
    setSecurityConfig(null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!masterKey) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      pendingImportTargetRef.current = {
        folderId: openArchive?.kind === 'folder' ? openArchive.folder.id : null,
        playlistId:
          activeSection === 'music' ? activePlaylistId || null : null,
      };
      importSelectedFiles(e.dataTransfer.files);
    }
  }

  if (showSplash || initializing) {
    return (
      <>
        <LiquidGlassBackground />
        <IntroSplash />
      </>
    );
  }

  // Locked or Initial Setup Gate
  if (!masterKey || !manifest) {
    return (
      <>
        <LiquidGlassBackground />
        <AuthGate
          existingConfig={securityConfig}
          onUnlockSuccess={({ key, manifest: unlockedManifest, config }) => {
            setSecurityConfig(config);
            setMasterKey(key);
            setManifest(unlockedManifest);
            setActivePlaylistId(unlockedManifest.playlists[0]?.id || '');
          }}
          onVaultReset={() => {
            setSecurityConfig(null);
            setMasterKey(null);
            setManifest(null);
          }}
        />
      </>
    );
  }

  return (
    <>
      <LiquidGlassBackground />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setIsDraggingOver(false);
        }}
        onDrop={handleDrop}
        className="relative z-10 min-h-screen text-slate-100"
      >

      {/* Hidden universal file input accepting ANY file format */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            importSelectedFiles(e.target.files);
          }
        }}
      />

      {/* Persistent audio element */}
      <audio
        ref={audioElRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          if (repeat && audioElRef.current) {
            audioElRef.current.currentTime = 0;
            audioElRef.current.play().catch(() => {});
          } else {
            handleNextOrPrevTrack('next');
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <TopNav
        activeSection={activeSection}
        onSelectSection={(section) => {
          setActiveSection(section);
          setOpenArchive(null);
        }}
        onTriggerImport={() =>
          triggerFilePicker({
            folderId:
              openArchive?.kind === 'folder' ? openArchive.folder.id : null,
            playlistId:
              activeSection === 'music' ? activePlaylistId || null : null,
          })
        }
      />

      {/* Subtle import confirmation toast */}
      {(importNotice || isImporting) && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-8">
          <div className="liquid-glass-subtle flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-xs text-slate-200">
            <span>
              {isImporting
                ? 'Cifrando y guardando archivos en tu casillero...'
                : importNotice}
            </span>
            {!isImporting && (
              <button
                type="button"
                onClick={() => setImportNotice(null)}
                className="text-slate-400 hover:text-white font-medium"
              >
                Ocultar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="pb-24">
        {openArchive ? (
          <ArchiveView
            mode={openArchive.kind}
            zipFile={openArchive.kind === 'zip' ? openArchive.file : undefined}
            zipBytes={openArchive.kind === 'zip' ? openArchive.bytes : undefined}
            folder={openArchive.kind === 'folder' ? openArchive.folder : undefined}
            folderFiles={
              openArchive.kind === 'folder'
                ? manifest.files.filter(
                    (f) => f.folderId === openArchive.folder.id
                  )
                : []
            }
            decryptedThumbnails={thumbnails}
            onBack={() => setOpenArchive(null)}
            onOpenFullscreenImages={(imgs, idx) => {
              setFullscreenImages(imgs);
              setFullscreenIndex(idx);
            }}
            onOpenDocument={(target) => setDocTarget(target)}
            onPlayExternalAudio={playExternalAudioBytes}
            onOpenVaultFile={handleOpenVaultFile}
            onImportIntoFolder={(folderId) => triggerFilePicker({ folderId })}
            onDeleteVaultFile={handleDeleteFile}
          />
        ) : activeSection === 'music' ? (
          <MusicPlaylistView
            audioFiles={audioFiles}
            playlists={manifest.playlists}
            activePlaylistId={activePlaylistId}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            shuffle={shuffle}
            repeat={repeat}
            volume={volume}
            onSelectPlaylist={setActivePlaylistId}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
            onPlayTrack={playVaultAudioFile}
            onTogglePlayPause={() => {
              const audio = audioElRef.current;
              if (!audio) return;
              if (audio.paused) {
                audio.play().catch(() => {});
              } else {
                audio.pause();
              }
            }}
            onPrevTrack={() => handleNextOrPrevTrack('prev')}
            onNextTrack={() => handleNextOrPrevTrack('next')}
            onSeek={(t) => {
              if (audioElRef.current) {
                audioElRef.current.currentTime = t;
                setCurrentTime(t);
              }
            }}
            onToggleShuffle={() => setShuffle((s) => !s)}
            onToggleRepeat={() => setRepeat((r) => !r)}
            onChangeVolume={(val) => {
              setVolume(val);
              if (audioElRef.current) audioElRef.current.volume = val;
            }}
            onImportMusic={(playlistId) =>
              triggerFilePicker({ playlistId, acceptAudio: true })
            }
            onDeleteAudioFile={handleDeleteFile}
          />
        ) : activeSection === 'security' && securityConfig ? (
          <SecurityView
            manifest={manifest}
            config={securityConfig}
            onLockVault={handleLockVault}
            onExportBackup={handleExportBackup}
            onRestoreBackup={handleRestoreBackup}
            onUpdateCredentials={handleUpdateCredentials}
            onWipeVault={handleWipeAndReset}
          />
        ) : (
          <GalleryGrid
            files={manifest.files}
            folders={manifest.folders}
            decryptedThumbnails={thumbnails}
            activeFilter={galleryFilter}
            archivesOnlySection={activeSection === 'archives'}
            onChangeFilter={setGalleryFilter}
            onOpenFile={handleOpenVaultFile}
            onOpenFolder={(folder) =>
              setOpenArchive({ kind: 'folder', folder })
            }
            onCreateFolder={handleCreateFolder}
            onDeleteFile={handleDeleteFile}
            onDeleteFolder={handleDeleteFolder}
            onTriggerImport={() => triggerFilePicker()}
            onLockVault={handleLockVault}
          />
        )}
      </main>

      {/* Drag & Drop Liquid Glass Overlay */}
      {isDraggingOver && (
        <div
          onDragLeave={() => setIsDraggingOver(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xl"
        >
          <div className="liquid-glass flex flex-col items-center rounded-3xl px-10 py-12 text-center">
            <Upload className="mb-3 h-8 w-8 text-sky-300" aria-hidden="true" />
            <p className="font-display text-lg font-semibold text-white">
              Suelta tus archivos aquí
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Se cifrarán con AES-256-GCM dentro de Prometheus
            </p>
          </div>
        </div>
      )}

      {/* Edge-to-Edge Fullscreen Photo Viewer */}
      {fullscreenImages.length > 0 && (
        <FullscreenPhotoViewer
          images={fullscreenImages}
          currentIndex={fullscreenIndex}
          onChangeIndex={setFullscreenIndex}
          onClose={() => setFullscreenImages([])}
          onDownload={(item) => {
            const a = document.createElement('a');
            a.href = item.url;
            a.download = item.name;
            a.click();
          }}
        />
      )}

      {/* Document / PDF / Video / Unknown Format Modal */}
      <DocumentViewerModal
        target={docTarget}
        onClose={() => setDocTarget(null)}
        onDownload={(target) => {
          const copy = new Uint8Array(target.bytes.byteLength);
          copy.set(target.bytes);
          const blob = new Blob([copy.buffer], {
            type: target.mimeType || 'application/octet-stream',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = target.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      />

      {/* Persistent Mini Audio Player when browsing outside Música */}
      {activeSection !== 'music' && fullscreenImages.length === 0 && (
        <MiniAudioPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onTogglePlayPause={() => {
            const audio = audioElRef.current;
            if (!audio) return;
            if (audio.paused) audio.play().catch(() => {});
            else audio.pause();
          }}
          onPrev={() => handleNextOrPrevTrack('prev')}
          onNext={() => handleNextOrPrevTrack('next')}
          onOpenMusicView={() => {
            setOpenArchive(null);
            setActiveSection('music');
          }}
          onClosePlayer={() => {
            audioElRef.current?.pause();
            if (currentTrack?.url) URL.revokeObjectURL(currentTrack.url);
            setCurrentTrack(null);
            setIsPlaying(false);
          }}
        />
      )}
      </div>
    </>
  );
}

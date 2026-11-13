import type {
  VaultFileMeta,
  VaultFolder,
  VaultManifest,
  VaultSecurityConfig,
} from '../types/vault';
import {
  base64ToBytes,
  computeSha256Hex,
  createSecurityConfig,
  decryptBytes,
  decryptJson,
  deriveMasterAesKey,
  encryptBytes,
  encryptJson,
  verifySinglePhase,
} from './crypto';
import { classifyFile, guessMimeType } from './fileClassification';
import {
  buildCalmAmbientWav,
  buildSamplePdfBytes,
  buildSampleZipBytes,
} from './syntheticSeedAssets';
import { DEMO_CREDENTIALS } from './vaultState';

// Generated gallery assets imported statically so Vite bundles them reliably
import alpineMistUrl from '../assets/images/gallery_alpine_mist_1794594378676.jpg';
import whiteArchUrl from '../assets/images/gallery_white_architecture_1794594379417.jpg';
import ceramicStillUrl from '../assets/images/gallery_ceramic_still_1794594379273.jpg';

const DB_NAME = 'prometheus_vault_v1';
const DB_VERSION = 1;
const STORE_META = 'meta';
const STORE_BLOBS = 'blobs';

const KEY_SECURITY_CONFIG = 'security_config';
const KEY_ENCRYPTED_MANIFEST = 'encrypted_manifest';

interface EncryptedBlobRecord {
  id: string;
  ivB64: string;
  ciphertext: ArrayBuffer;
}

interface EncryptedManifestRecord {
  ivB64: string;
  ciphertext: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openVaultDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error('Base de datos IndexedDB bloqueada'));
    };
  });
  return dbPromise;
}

async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName: string, value: unknown, key?: string): Promise<void> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = key !== undefined ? store.put(value, key) : store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSecurityConfig(): Promise<VaultSecurityConfig | null> {
  const cfg = await idbGet<VaultSecurityConfig>(STORE_META, KEY_SECURITY_CONFIG);
  return cfg ?? null;
}

export async function saveManifest(
  key: CryptoKey,
  manifest: VaultManifest
): Promise<void> {
  const encrypted = await encryptJson(key, manifest);
  await idbPut(STORE_META, encrypted, KEY_ENCRYPTED_MANIFEST);
}

export async function loadManifest(key: CryptoKey): Promise<VaultManifest> {
  const record = await idbGet<EncryptedManifestRecord>(
    STORE_META,
    KEY_ENCRYPTED_MANIFEST
  );
  if (!record) {
    return {
      version: 1,
      files: [],
      folders: [],
      playlists: [],
    };
  }
  return decryptJson<VaultManifest>(key, record.ivB64, record.ciphertext);
}

export async function verifyVaultPhase(
  phase: 1 | 2 | 3,
  candidate: string
): Promise<boolean> {
  const cfg = await getSecurityConfig();
  if (!cfg) return false;
  return verifySinglePhase(cfg, phase, candidate);
}

export async function unlockVaultWithThreePhases(
  phase1Password: string,
  phase2Pin: string,
  phase3Key: string
): Promise<{ key: CryptoKey; manifest: VaultManifest; config: VaultSecurityConfig }> {
  const cfg = await getSecurityConfig();
  if (!cfg) {
    throw new Error('No existe un casillero configurado.');
  }

  const [ok1, ok2, ok3] = await Promise.all([
    verifySinglePhase(cfg, 1, phase1Password),
    verifySinglePhase(cfg, 2, phase2Pin),
    verifySinglePhase(cfg, 3, phase3Key),
  ]);

  if (!ok1 || !ok2 || !ok3) {
    throw new Error('Las credenciales de acceso no coinciden.');
  }

  const salt = base64ToBytes(cfg.saltB64);
  const key = await deriveMasterAesKey(
    phase1Password,
    phase2Pin,
    phase3Key,
    salt,
    cfg.iterations
  );
  const manifest = await loadManifest(key);
  return { key, manifest, config: cfg };
}

export async function storeEncryptedFile(
  key: CryptoKey,
  name: string,
  bytes: Uint8Array,
  mimeTypeInput: string,
  folderId: string | null = null
): Promise<VaultFileMeta> {
  const id = globalThis.crypto.randomUUID();
  const mimeType = guessMimeType(name, mimeTypeInput);
  const category = classifyFile(name, mimeType);
  const sha256 = await computeSha256Hex(bytes);
  const { ivB64, ciphertext } = await encryptBytes(key, bytes);

  const blobRecord: EncryptedBlobRecord = {
    id,
    ivB64,
    ciphertext,
  };
  await idbPut(STORE_BLOBS, blobRecord);

  return {
    id,
    name,
    size: bytes.byteLength,
    mimeType,
    category,
    createdAt: Date.now(),
    folderId,
    sha256,
  };
}

export async function readDecryptedFile(
  key: CryptoKey,
  fileId: string
): Promise<Uint8Array> {
  const record = await idbGet<EncryptedBlobRecord>(STORE_BLOBS, fileId);
  if (!record) {
    throw new Error('Archivo cifrado no encontrado en el casillero.');
  }
  return decryptBytes(key, record.ivB64, record.ciphertext);
}

export async function removeEncryptedFile(fileId: string): Promise<void> {
  await idbDelete(STORE_BLOBS, fileId);
}

async function fetchAssetBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function createNewVault(options: {
  phase1Password: string;
  phase2Pin: string;
  phase3Key: string;
  phase3Prompt: string;
  seedStarterContent: boolean;
}): Promise<{ key: CryptoKey; manifest: VaultManifest; config: VaultSecurityConfig }> {
  const { config, masterKey } = await createSecurityConfig(
    options.phase1Password,
    options.phase2Pin,
    options.phase3Key,
    options.phase3Prompt
  );

  await idbPut(STORE_META, config, KEY_SECURITY_CONFIG);

  const files: VaultFileMeta[] = [];
  const folders: VaultFolder[] = [];
  const trackIds: string[] = [];

  if (options.seedStarterContent) {
    const [alpineBytes, archBytes, ceramicBytes] = await Promise.all([
      fetchAssetBytes(alpineMistUrl),
      fetchAssetBytes(whiteArchUrl),
      fetchAssetBytes(ceramicStillUrl),
    ]);

    if (alpineBytes) {
      files.push(
        await storeEncryptedFile(
          masterKey,
          'Bruma en Lago Alpino.jpg',
          alpineBytes,
          'image/jpeg'
        )
      );
    }
    if (archBytes) {
      files.push(
        await storeEncryptedFile(
          masterKey,
          'Pabellón Cristal Blanco.jpg',
          archBytes,
          'image/jpeg'
        )
      );
    }
    if (ceramicBytes) {
      files.push(
        await storeEncryptedFile(
          masterKey,
          'Porcelana y Esfera.jpg',
          ceramicBytes,
          'image/jpeg'
        )
      );
    }

    // Valid PDF
    const pdfBytes = buildSamplePdfBytes();
    files.push(
      await storeEncryptedFile(
        masterKey,
        'Manual de Privacidad Prometheus.pdf',
        pdfBytes,
        'application/pdf'
      )
    );

    // Valid ZIP archive containing nested files
    const zipBytes = await buildSampleZipBytes(alpineBytes ?? undefined);
    files.push(
      await storeEncryptedFile(
        masterKey,
        'Bitácora y Fotos del Viaje.zip',
        zipBytes,
        'application/zip'
      )
    );

    // Custom Archivero (Folder) with nested private document
    const personalFolder: VaultFolder = {
      id: globalThis.crypto.randomUUID(),
      name: 'Documentos Personales',
      description: 'Notas y respaldos privados dentro de este archivero',
      createdAt: Date.now(),
    };
    folders.push(personalFolder);

    const noteBytes = new TextEncoder().encode(
      'Notas privadas\n\nEste archivo está guardado únicamente en el interior del archivero "Documentos Personales".\nAl abrir un archivero en Prometheus solo se muestran los archivos en su interior.'
    );
    files.push(
      await storeEncryptedFile(
        masterKey,
        'Notas_Privadas.txt',
        noteBytes,
        'text/plain',
        personalFolder.id
      )
    );

    // Ambient Music Tracks
    const track1 = await storeEncryptedFile(
      masterKey,
      'Bruma Matinal — Piano Sereno.wav',
      buildCalmAmbientWav([220, 277.18, 329.63, 440], 9),
      'audio/wav'
    );
    const track2 = await storeEncryptedFile(
      masterKey,
      'Cristal de Nieve — Armónicos.wav',
      buildCalmAmbientWav([261.63, 329.63, 392.0, 523.25], 9),
      'audio/wav'
    );
    const track3 = await storeEncryptedFile(
      masterKey,
      'Horizonte Calmo — Atmósfera.wav',
      buildCalmAmbientWav([196.0, 246.94, 293.66, 392.0], 9),
      'audio/wav'
    );
    files.push(track1, track2, track3);
    trackIds.push(track1.id, track2.id, track3.id);
  }

  const manifest: VaultManifest = {
    version: 1,
    files,
    folders,
    playlists: [
      {
        id: 'default-serene',
        name: 'Calma Personal',
        createdAt: Date.now(),
        trackIds,
      },
    ],
  };

  await saveManifest(masterKey, manifest);
  return { key: masterKey, manifest, config };
}

export async function createOrUnlockDemoVault(
  seedStarterContent = false
): Promise<{
  key: CryptoKey;
  manifest: VaultManifest;
  config: VaultSecurityConfig;
}> {
  const existing = await getSecurityConfig();
  if (existing) {
    try {
      return await unlockVaultWithThreePhases(
        DEMO_CREDENTIALS.phase1Password,
        DEMO_CREDENTIALS.phase2Pin,
        DEMO_CREDENTIALS.phase3Key
      );
    } catch {
      await wipeEntireVault();
    }
  }
  return createNewVault({
    phase1Password: DEMO_CREDENTIALS.phase1Password,
    phase2Pin: DEMO_CREDENTIALS.phase2Pin,
    phase3Key: DEMO_CREDENTIALS.phase3Key,
    phase3Prompt: DEMO_CREDENTIALS.phase3Prompt,
    seedStarterContent,
  });
}

export async function wipeEntireVault(): Promise<void> {
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
    tx.objectStore(STORE_META).clear();
    tx.objectStore(STORE_BLOBS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

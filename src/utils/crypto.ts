import type { VaultSecurityConfig } from '../types/vault';

const DEFAULT_ITERATIONS = 50_000;

function getSubtle(): SubtleCrypto {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('Web Crypto API no disponible en este entorno');
  }
  return globalThis.crypto.subtle;
}

export function generateRandomBytes(length = 16): Uint8Array {
  const arr = new Uint8Array(length);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function derivePhaseVerifier(
  secret: string,
  salt: Uint8Array,
  phaseTag: string,
  iterations = DEFAULT_ITERATIONS
): Promise<string> {
  const subtle = getSubtle();
  const encoder = new TextEncoder();
  const materialBytes = encoder.encode(`prometheus:${phaseTag}:${secret.trim()}`);
  const baseKey = await subtle.importKey(
    'raw',
    toArrayBuffer(materialBytes),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const taggedSalt = new Uint8Array(salt.length + phaseTag.length);
  taggedSalt.set(salt, 0);
  taggedSalt.set(encoder.encode(phaseTag), salt.length);

  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(taggedSalt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  return bytesToBase64(new Uint8Array(bits));
}

export async function deriveMasterAesKey(
  phase1Secret: string,
  phase2Pin: string,
  phase3Key: string,
  salt: Uint8Array,
  iterations = DEFAULT_ITERATIONS
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const encoder = new TextEncoder();
  const combined = encoder.encode(
    `p1:${phase1Secret}|p2:${phase2Pin.trim()}|p3:${phase3Key.trim().toLowerCase()}`
  );

  const baseKey = await subtle.importKey(
    'raw',
    toArrayBuffer(combined),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function createSecurityConfig(
  phase1Secret: string,
  phase2Pin: string,
  phase3Key: string,
  phase3Prompt: string,
  iterations = DEFAULT_ITERATIONS
): Promise<{ config: VaultSecurityConfig; masterKey: CryptoKey }> {
  const salt = generateRandomBytes(16);
  const normalizedP3 = phase3Key.trim().toLowerCase();

  const [phase1HashB64, phase2HashB64, phase3HashB64, masterKey] = await Promise.all([
    derivePhaseVerifier(phase1Secret, salt, 'phase1', iterations),
    derivePhaseVerifier(phase2Pin, salt, 'phase2', iterations),
    derivePhaseVerifier(normalizedP3, salt, 'phase3', iterations),
    deriveMasterAesKey(phase1Secret, phase2Pin, normalizedP3, salt, iterations),
  ]);

  const now = Date.now();
  return {
    config: {
      version: 1,
      saltB64: bytesToBase64(salt),
      iterations,
      phase1HashB64,
      phase2HashB64,
      phase3HashB64,
      phase3Prompt: phase3Prompt.trim() || 'Palabra clave de resguardo',
      createdAt: now,
      updatedAt: now,
    },
    masterKey,
  };
}

export async function verifySinglePhase(
  config: VaultSecurityConfig,
  phase: 1 | 2 | 3,
  candidate: string
): Promise<boolean> {
  const salt = base64ToBytes(config.saltB64);
  const normalized = phase === 3 ? candidate.trim().toLowerCase() : candidate;
  const tag = `phase${phase}`;
  const expectedB64 =
    phase === 1
      ? config.phase1HashB64
      : phase === 2
      ? config.phase2HashB64
      : config.phase3HashB64;

  const actualB64 = await derivePhaseVerifier(
    normalized,
    salt,
    tag,
    config.iterations
  );
  return constantTimeEqual(base64ToBytes(actualB64), base64ToBytes(expectedB64));
}

export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array
): Promise<{ ivB64: string; ciphertext: ArrayBuffer }> {
  const subtle = getSubtle();
  const iv = generateRandomBytes(12);
  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(plaintext)
  );
  return {
    ivB64: bytesToBase64(iv),
    ciphertext,
  };
}

export async function decryptBytes(
  key: CryptoKey,
  ivB64: string,
  ciphertext: ArrayBuffer
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const iv = base64ToBytes(ivB64);
  const plainBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    ciphertext
  );
  return new Uint8Array(plainBuffer);
}

export async function encryptJson(
  key: CryptoKey,
  data: unknown
): Promise<{ ivB64: string; ciphertext: ArrayBuffer }> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(JSON.stringify(data));
  return encryptBytes(key, bytes);
}

export async function decryptJson<T>(
  key: CryptoKey,
  ivB64: string,
  ciphertext: ArrayBuffer
): Promise<T> {
  const bytes = await decryptBytes(key, ivB64, ciphertext);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(bytes)) as T;
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = getSubtle();
  const digest = await subtle.digest('SHA-256', toArrayBuffer(bytes));
  const arr = new Uint8Array(digest);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

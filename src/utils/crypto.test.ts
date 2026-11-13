import test from 'node:test';
import assert from 'node:assert/strict';
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

test('3-phase security config verifies each phase accurately and rejects wrong secrets', async () => {
  const { config } = await createSecurityConfig(
    'ClaveSegura99',
    '135790',
    'Montaña Blanca',
    'Lugar favorito',
    5_000
  );

  assert.equal(await verifySinglePhase(config, 1, 'ClaveSegura99'), true);
  assert.equal(await verifySinglePhase(config, 1, 'ClaveIncorrecta'), false);

  assert.equal(await verifySinglePhase(config, 2, '135790'), true);
  assert.equal(await verifySinglePhase(config, 2, '000000'), false);

  // Phase 3 is normalized case-insensitively and trimmed
  assert.equal(await verifySinglePhase(config, 3, '  montaña blanca  '), true);
  assert.equal(await verifySinglePhase(config, 3, 'otra palabra'), false);
});

test('AES-256-GCM encrypts and decrypts binary data and JSON manifests cleanly', async () => {
  const { config, masterKey } = await createSecurityConfig(
    'MasterPass123',
    '481516',
    'Horizonte',
    'Pista',
    5_000
  );

  const original = new TextEncoder().encode('Contenido confidencial de Prometheus');
  const encrypted = await encryptBytes(masterKey, original);

  // Re-derive key independently from the 3 secrets
  const salt = base64ToBytes(config.saltB64);
  const rederivedKey = await deriveMasterAesKey(
    'MasterPass123',
    '481516',
    'horizonte',
    salt,
    config.iterations
  );

  const decrypted = await decryptBytes(
    rederivedKey,
    encrypted.ivB64,
    encrypted.ciphertext
  );
  assert.deepEqual(decrypted, original);

  // Wrong phase 3 secret produces a wrong key that cannot decrypt
  const wrongKey = await deriveMasterAesKey(
    'MasterPass123',
    '481516',
    'equivocada',
    salt,
    config.iterations
  );
  await assert.rejects(
    decryptBytes(wrongKey, encrypted.ivB64, encrypted.ciphertext)
  );

  const jsonPayload = { files: ['a.jpg', 'b.pdf'], count: 2 };
  const encJson = await encryptJson(masterKey, jsonPayload);
  const decJson = await decryptJson<typeof jsonPayload>(
    rederivedKey,
    encJson.ivB64,
    encJson.ciphertext
  );
  assert.deepEqual(decJson, jsonPayload);
});

test('SHA-256 digest computes deterministic 64-char hex checksum', async () => {
  const bytes = new TextEncoder().encode('prometheus');
  const hash = await computeSha256Hex(bytes);
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

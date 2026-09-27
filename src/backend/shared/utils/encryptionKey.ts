import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

// Secrets that must be *recovered* in plaintext later (e-commerce webhook
// signing secrets — HMAC verification needs the real secret, a one-way hash
// won't do) are encrypted at rest with this key, rather than stored as-is.
// The key itself lives next to the database file but is never written into
// the database, so a stolen/shared database file alone does not expose any
// integration secret. ENCRYPTION_KEY lets an operator pin one explicitly
// (recommended for anything internet-facing); otherwise one is generated on
// first use and persisted, mirroring getOrCreateSessionSecret.
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // recommended IV length for GCM

const getOrCreateEncryptionKey = (dbDir: string): Buffer => {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    return Buffer.from(envKey.slice(0, 64), 'hex').length === KEY_BYTES
      ? Buffer.from(envKey.slice(0, 64), 'hex')
      : Buffer.from(envKey).subarray(0, KEY_BYTES);
  }

  const keyPath = path.resolve(dbDir, '.encryption_key');
  try {
    if (fs.existsSync(keyPath)) {
      const existing = fs.readFileSync(keyPath, 'utf-8').trim();
      if (existing.length === KEY_BYTES * 2) return Buffer.from(existing, 'hex');
    }
  } catch {
    // fall through to generating a new one
  }

  const key = randomBytes(KEY_BYTES);
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
  } catch (error) {
    console.warn('Could not persist encryption key; encrypted secrets will not survive a restart.', error);
  }
  return key;
};

// Format: base64(iv) . base64(authTag) . base64(ciphertext)
export const encryptSecret = (dbDir: string, plaintext: string): string => {
  const key = getOrCreateEncryptionKey(dbDir);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join('.');
};

export const decryptSecret = (dbDir: string, encoded: string): string | null => {
  try {
    const key = getOrCreateEncryptionKey(dbDir);
    const [ivB64, tagB64, dataB64] = encoded.split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return plaintext.toString('utf-8');
  } catch {
    // Wrong key, corrupted value, or tampering — never throw into caller
    // code that might leak details; just treat it as unrecoverable.
    return null;
  }
};

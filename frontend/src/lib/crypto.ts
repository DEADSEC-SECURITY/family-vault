/**
 * crypto.ts — Zero-knowledge cryptography using the Web Crypto API.
 *
 * Implements Bitwarden-style key hierarchy:
 *   Password → PBKDF2 → Master Key → HKDF → Symmetric Key (encrypts RSA private key)
 *   Password → PBKDF2(masterKey, password, 1) → Master Password Hash (sent to server)
 *   RSA-OAEP 2048 keypair per user (private key encrypted with symmetric key)
 *   Org Key (AES-256-GCM) wrapped per-member with RSA public key
 *
 * The server NEVER sees the password or master key.
 */

const KDF_ITERATIONS = 600_000;
const HASH_ITERATIONS = 1; // single iteration for master password hash

// ── Helpers ──────────────────────────────────────────────────────

/** Encode string to ArrayBuffer (Web Crypto compatible). */
function encode(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

function decode(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

/** Convert Uint8Array to ArrayBuffer (ensures strict ArrayBuffer type for Web Crypto). */
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Shared AES-256-GCM primitives ────────────────────────────────

/** Import a raw Uint8Array as an AES-GCM CryptoKey. */
async function importAesKey(
  raw: Uint8Array,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(raw), "AES-GCM", false, usage);
}

/** AES-256-GCM encrypt: returns iv (12 bytes) + ciphertext as ArrayBuffer. */
async function aesEncrypt(data: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return toArrayBuffer(combined);
}

/** AES-256-GCM decrypt: expects iv (12 bytes) + ciphertext as ArrayBuffer. */
async function aesDecrypt(encrypted: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const combined = new Uint8Array(encrypted);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );
}

// ── Key Derivation ───────────────────────────────────────────────

/**
 * Derive the 256-bit Master Key from password + email using PBKDF2.
 * This key never leaves the client.
 */
export async function deriveMasterKey(
  password: string,
  email: string,
  iterations: number = KDF_ITERATIONS,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encode(email.toLowerCase().trim()),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "HKDF", length: 256 },
    true, // extractable — needed for HKDF derivation and recovery key
    ["deriveBits", "deriveKey"],
  );
}

/**
 * Derive the Symmetric Key from Master Key using HKDF.
 * Used to encrypt/decrypt the user's RSA private key.
 */
export async function deriveSymmetricKey(
  masterKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encode("familyvault"),
      info: encode("enc"),
    },
    masterKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Compute the Master Password Hash: PBKDF2(masterKey, password, 1 iteration).
 * This is what gets sent to the server for authentication (server bcrypt-hashes it).
 */
export async function hashMasterPassword(
  masterKey: CryptoKey,
  password: string,
): Promise<string> {
  const masterKeyRaw = await crypto.subtle.exportKey("raw", masterKey);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    masterKeyRaw,
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const hashBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encode(password),
      iterations: HASH_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return toBase64(hashBits);
}

// ── RSA Keypair ──────────────────────────────────────────────────

/**
 * Generate a new RSA-OAEP 2048-bit keypair for key wrapping.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"],
  ) as Promise<CryptoKeyPair>;
}

/**
 * Export RSA public key to base64-encoded SPKI format.
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", key);
  return toBase64(spki);
}

/**
 * Import RSA public key from base64-encoded SPKI format.
 */
export async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    toArrayBuffer(fromBase64(b64)),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["wrapKey", "encrypt"],
  );
}

/**
 * Encrypt RSA private key with an AES-GCM key. Returns base64 string.
 */
export async function encryptPrivateKey(
  privateKey: CryptoKey,
  symmetricKey: CryptoKey,
): Promise<string> {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey);
  return toBase64(await aesEncrypt(pkcs8, symmetricKey));
}

/**
 * Decrypt RSA private key with an AES-GCM key.
 */
export async function decryptPrivateKey(
  encrypted: string,
  symmetricKey: CryptoKey,
): Promise<CryptoKey> {
  const pkcs8 = await aesDecrypt(toArrayBuffer(fromBase64(encrypted)), symmetricKey);
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["unwrapKey", "decrypt"],
  );
}

// ── Org Key Operations ───────────────────────────────────────────

/**
 * Generate a random 256-bit AES org key.
 */
export function generateOrgKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Wrap (encrypt) an org key with an RSA public key. Returns base64.
 */
export async function wrapOrgKey(
  orgKey: Uint8Array,
  publicKey: CryptoKey,
): Promise<string> {
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    toArrayBuffer(orgKey),
  );
  return toBase64(encrypted);
}

/**
 * Unwrap (decrypt) an org key with the user's RSA private key.
 */
export async function unwrapOrgKey(
  wrapped: string,
  privateKey: CryptoKey,
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    toArrayBuffer(fromBase64(wrapped)),
  );
  return new Uint8Array(decrypted);
}

// ── Data Encryption (AES-256-GCM with org key) ──────────────────

/**
 * Encrypt a string with the org key. Returns base64.
 */
export async function encryptString(
  plaintext: string,
  orgKey: Uint8Array,
): Promise<string> {
  const key = await importAesKey(orgKey, ["encrypt"]);
  return toBase64(await aesEncrypt(encode(plaintext), key));
}

/**
 * Decrypt a base64 string with the org key.
 */
export async function decryptString(
  ciphertext: string,
  orgKey: Uint8Array,
): Promise<string> {
  const key = await importAesKey(orgKey, ["decrypt"]);
  return decode(await aesDecrypt(toArrayBuffer(fromBase64(ciphertext)), key));
}

/**
 * Encrypt a file (ArrayBuffer) with the org key. Returns ArrayBuffer.
 */
export async function encryptFile(
  file: ArrayBuffer,
  orgKey: Uint8Array,
): Promise<ArrayBuffer> {
  const key = await importAesKey(orgKey, ["encrypt"]);
  return aesEncrypt(file, key);
}

/**
 * Decrypt a file (ArrayBuffer) with the org key. Returns ArrayBuffer.
 */
export async function decryptFile(
  encrypted: ArrayBuffer,
  orgKey: Uint8Array,
): Promise<ArrayBuffer> {
  const key = await importAesKey(orgKey, ["decrypt"]);
  return aesDecrypt(encrypted, key);
}

// ── Recovery Key ─────────────────────────────────────────────────

/**
 * Export the master key as a base64 recovery key string.
 * Shown to the user once at registration.
 */
export async function exportRecoveryKey(masterKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", masterKey);
  return toBase64(raw);
}

/**
 * Encrypt the RSA private key with a recovery key for backup.
 */
export async function encryptPrivateKeyForRecovery(
  privateKey: CryptoKey,
  recoveryKeyB64: string,
): Promise<string> {
  const symmetricKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(fromBase64(recoveryKeyB64)),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  return encryptPrivateKey(privateKey, symmetricKey);
}

/**
 * Decrypt the RSA private key using a recovery key (base64).
 * Used during password reset when the user provides their recovery key.
 */
export async function decryptPrivateKeyWithRecovery(
  encrypted: string,
  recoveryKeyB64: string,
): Promise<CryptoKey> {
  const symmetricKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(fromBase64(recoveryKeyB64)),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  return decryptPrivateKey(encrypted, symmetricKey);
}

// ── Constants Export ─────────────────────────────────────────────

export const CRYPTO_CONSTANTS = {
  KDF_ITERATIONS,
  HASH_ITERATIONS,
} as const;

/**
 * key-store.ts — In-memory singleton for decrypted cryptographic keys.
 *
 * Keys live ONLY in JavaScript memory — never in localStorage, sessionStorage,
 * or IndexedDB. On page refresh or logout, all keys are lost (user must re-login).
 *
 * Usage:
 *   import { keyStore } from "@/lib/key-store";
 *   keyStore.setMasterKey(key);
 *   const orgKey = keyStore.getOrgKey(orgId);
 *   keyStore.clear(); // on logout
 */

class KeyStore {
  private masterKey: CryptoKey | null = null;
  private symmetricKey: CryptoKey | null = null;
  private privateKey: CryptoKey | null = null;
  private publicKey: CryptoKey | null = null;
  private orgKeys = new Map<string, Uint8Array>();

  // ── Master Key ───────────────────────────────────────────────

  setMasterKey(key: CryptoKey): void {
    this.masterKey = key;
  }

  getMasterKey(): CryptoKey {
    if (!this.masterKey) {
      throw new Error("Master key not available — user must log in");
    }
    return this.masterKey;
  }

  hasMasterKey(): boolean {
    return this.masterKey !== null;
  }

  // ── Symmetric Key (derived from master key) ──────────────────

  setSymmetricKey(key: CryptoKey): void {
    this.symmetricKey = key;
  }

  getSymmetricKey(): CryptoKey {
    if (!this.symmetricKey) {
      throw new Error("Symmetric key not available — user must log in");
    }
    return this.symmetricKey;
  }

  // ── RSA Private Key ──────────────────────────────────────────

  setPrivateKey(key: CryptoKey): void {
    this.privateKey = key;
  }

  getPrivateKey(): CryptoKey {
    if (!this.privateKey) {
      throw new Error("Private key not available — user must log in");
    }
    return this.privateKey;
  }

  hasPrivateKey(): boolean {
    return this.privateKey !== null;
  }

  // ── RSA Public Key ───────────────────────────────────────────

  setPublicKey(key: CryptoKey): void {
    this.publicKey = key;
  }

  getPublicKey(): CryptoKey {
    if (!this.publicKey) {
      throw new Error("Public key not available — user must log in");
    }
    return this.publicKey;
  }

  hasPublicKey(): boolean {
    return this.publicKey !== null;
  }

  // ── Org Keys ─────────────────────────────────────────────────

  setOrgKey(orgId: string, key: Uint8Array): void {
    this.orgKeys.set(orgId, key);
  }

  getOrgKey(orgId: string): Uint8Array {
    const key = this.orgKeys.get(orgId);
    if (!key) {
      throw new Error(`Org key not available for org ${orgId}`);
    }
    return key;
  }

  hasOrgKey(orgId: string): boolean {
    return this.orgKeys.has(orgId);
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /** Clear all keys from memory. Call on logout. */
  clear(): void {
    this.masterKey = null;
    this.symmetricKey = null;
    this.privateKey = null;
    this.publicKey = null;
    this.orgKeys.clear();
  }

  /** Check if the store has been initialized (user is logged in with keys). */
  get isInitialized(): boolean {
    return this.masterKey !== null && this.privateKey !== null;
  }
}

/** Global singleton — one instance for the entire app. */
export const keyStore = new KeyStore();

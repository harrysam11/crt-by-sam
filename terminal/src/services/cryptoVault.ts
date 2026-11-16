/**
 * Client-Side Zero-Knowledge Encryption Vault using Web Crypto API (AES-GCM 256-bit)
 * Ensures API secrets, private keys, and workspace backups are never stored in plain text.
 */

import { validateVaultPayloadStructure } from '../utils/security';

const SALT_BYTES = 16;
const IV_BYTES = 12;

function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hex2buf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Derive an AES-GCM 256 key from a passphrase using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string with a passphrase using AES-GCM
 */
export async function encryptSecret(plainText: string, password: string): Promise<string> {
  if (!plainText || plainText.length > 500000) {
    throw new Error('Plaintext payload exceeds allowable size limit (500KB).');
  }
  if (!password || password.trim().length === 0) {
    throw new Error('Passphrase cannot be empty.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText)
  );

  return JSON.stringify({
    salt: buf2hex(salt.buffer),
    iv: buf2hex(iv.buffer),
    ciphertext: buf2hex(encrypted),
  });
}

/**
 * Decrypt ciphertext with a passphrase using AES-GCM
 */
export async function decryptSecret(payloadStr: string, password: string): Promise<string> {
  if (!payloadStr || typeof payloadStr !== 'string') {
    throw new Error('Invalid vault payload parameter.');
  }
  if (!password) {
    throw new Error('Decryption passphrase required.');
  }

  let rawObj: unknown;
  try {
    rawObj = JSON.parse(payloadStr);
  } catch {
    throw new Error('Corrupted or invalid JSON in vault data.');
  }

  const validation = validateVaultPayloadStructure(rawObj);
  if (!validation.ok || !validation.parsed) {
    throw new Error(validation.error || 'Corrupted vault payload structure.');
  }

  const { salt: saltHex, iv: ivHex, ciphertext: cipherHex } = validation.parsed;
  const salt = hex2buf(saltHex);
  const iv = hex2buf(ivHex);
  const ciphertext = hex2buf(cipherHex);
  const key = await deriveKey(password, salt);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

export type SupportedBroker =
  | 'METATRADER_5'
  | 'TRADOVATE'
  | 'INTERACTIVE_BROKERS'
  | 'DELTA_EXCHANGE'
  | 'BINANCE'
  | 'BYBIT'
  | 'OANDA'
  | 'CUSTOM';

export interface ApiCredentials {
  broker: SupportedBroker;
  apiKey: string;
  apiSecret: string;
  subAccountId?: string;
  isTestnet: boolean;
  server?: string;
  gatewayUrl?: string;
  appId?: string;
  accountNumber?: string;
}

const VAULT_STORAGE_KEY = 'crt_secure_vault_v1';

export function saveEncryptedVault(encryptedPayload: string): void {
  localStorage.setItem(VAULT_STORAGE_KEY, encryptedPayload);
}

export function loadEncryptedVault(): string | null {
  return localStorage.getItem(VAULT_STORAGE_KEY);
}

export function clearVault(): void {
  localStorage.removeItem(VAULT_STORAGE_KEY);
}

import { toHex, utf8 } from './encoding';

export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', utf8(value)));
}

const hmacKeys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = hmacKeys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ]);
    hmacKeys.set(secret, key);
  }
  return key;
}

export async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  return toHex(await crypto.subtle.sign('HMAC', await hmacKey(secret), utf8(value)));
}

/** Constant-time comparison of two hex strings (lengths are not secret). */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

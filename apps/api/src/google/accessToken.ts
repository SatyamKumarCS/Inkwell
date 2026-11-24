import type { ServiceAccount } from '../config';
import { importPrivateKeyPem, signJwtRs256 } from '../crypto/jwt';

/** Covers Firestore, Identity Toolkit and FCM. */
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/firebase.messaging',
].join(' ');

/** Somewhere to share tokens across isolates (the AuthGuard Durable Object). */
export interface TokenStore {
  getToken(key: string, nowMs: number): Promise<string | null>;
  putToken(key: string, token: string, expiresAtMs: number): Promise<void>;
}

const memory = new Map<string, { token: string; expiresAtMs: number }>();

/** Refresh this long before Google's expiry so a token never expires mid-request. */
const MARGIN_MS = 5 * 60 * 1000;

/**
 * An OAuth access token for the service account (JWT bearer grant). Minting one costs an RS256 signature
 * plus a round trip, so tokens are cached per isolate and in the shared store for about 55 minutes.
 */
export async function getAccessToken(
  sa: ServiceAccount,
  store: TokenStore,
  nowMs = Date.now(),
): Promise<string> {
  const key = tokenKey(sa);
  const cached = memory.get(key);
  if (cached && cached.expiresAtMs > nowMs) return cached.token;

  const shared = await store.getToken(key, nowMs);
  if (shared) {
    memory.set(key, { token: shared, expiresAtMs: nowMs + MARGIN_MS });
    return shared;
  }
  return mintAccessToken(sa, store, nowMs);
}

/**
 * Called by the scheduled handler: mints a new token into the shared store when the stored one expires
 * within `minValidityMs`, so user requests find a cached token instead of paying for the RS256 signature
 * (~1.3 ms of CPU with the key import, measured). Returns whether it minted.
 */
export async function refreshAccessToken(
  sa: ServiceAccount,
  store: TokenStore,
  minValidityMs: number,
  nowMs = Date.now(),
): Promise<boolean> {
  if (await store.getToken(tokenKey(sa), nowMs + minValidityMs)) return false;
  await mintAccessToken(sa, store, nowMs);
  return true;
}

const tokenKey = (sa: ServiceAccount) => `oauth:${sa.client_email}:${sa.private_key_id}`;

async function mintAccessToken(sa: ServiceAccount, store: TokenStore, nowMs: number) {
  const key = tokenKey(sa);
  const iat = Math.floor(nowMs / 1000);
  const assertion = await signJwtRs256(
    { iss: sa.client_email, scope: SCOPES, aud: sa.token_uri, iat, exp: iat + 3600 },
    await importPrivateKeyPem(sa.private_key),
    { kid: sa.private_key_id },
  );
  const response = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token endpoint responded ${response.status}: ${await response.text()}`);
  }
  const { access_token: token, expires_in: expiresIn } = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  const expiresAtMs = nowMs + expiresIn * 1000 - MARGIN_MS;
  memory.set(key, { token, expiresAtMs });
  await store.putToken(key, token, expiresAtMs);
  return token;
}

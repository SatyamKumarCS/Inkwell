import { importRsaPublicJwk } from '../crypto/jwt';

/** Google's signing keys for Firebase ID tokens and Google ID tokens. */
export const FIREBASE_ID_TOKEN_JWKS =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
export const GOOGLE_ID_TOKEN_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';

/** Looks up a public key by `kid`. */
export type KeySource = (kid: string) => Promise<CryptoKey | null>;

interface CachedKeys {
  keys: Map<string, CryptoKey>;
  expiresAtMs: number;
}

const caches = new Map<string, CachedKeys>();
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;

async function fetchKeys(url: string): Promise<CachedKeys> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`);
  const { keys } = (await response.json()) as { keys: (JsonWebKey & { kid?: string })[] };
  const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1];
  const imported = new Map<string, CryptoKey>();
  for (const jwk of keys) {
    if (jwk.kid && jwk.kty === 'RSA') imported.set(jwk.kid, await importRsaPublicJwk(jwk));
  }
  return {
    keys: imported,
    expiresAtMs: Date.now() + (maxAge ? Number(maxAge) * 1000 : DEFAULT_MAX_AGE_MS),
  };
}

/** Keys from a JWKS URL, cached per isolate for as long as Google's Cache-Control allows. */
export function jwksKeySource(url: string): KeySource {
  return async (kid) => {
    let cached = caches.get(url);
    if (!cached || cached.expiresAtMs <= Date.now() || !cached.keys.has(kid)) {
      // An unknown kid can mean Google rotated keys: refetch (at most once per lookup).
      cached = await fetchKeys(url);
      caches.set(url, cached);
    }
    return cached.keys.get(kid) ?? null;
  };
}

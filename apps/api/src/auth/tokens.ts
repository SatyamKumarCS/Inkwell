import type { ServiceAccount } from '../config';
import { decodeJwt, importPrivateKeyPem, signJwtRs256, verifyRs256 } from '../crypto/jwt';
import { ApiError } from '../http';
import type { KeySource } from '../google/jwks';

const CUSTOM_TOKEN_AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

/** A Firebase custom token (signed by the service account), exchanged by the app for a session. */
export async function createCustomToken(
  sa: ServiceAccount,
  uid: string,
  nowMs = Date.now(),
): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return signJwtRs256(
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: CUSTOM_TOKEN_AUDIENCE,
      iat,
      exp: iat + 3600,
      uid,
    },
    await importPrivateKeyPem(sa.private_key),
    { kid: sa.private_key_id },
  );
}

export interface VerifiedCaller {
  uid: string;
  email: string | null;
  picture: string | null;
}

/** Allowed clock difference between Google and Cloudflare. */
const SKEW_SECONDS = 300;

/**
 * Verifies a Firebase ID token from `Authorization: Bearer`. In emulator mode the Auth emulator issues
 * unsigned tokens, so only the claims are checked; the config guarantees that mode can't run in production.
 */
export async function verifyFirebaseIdToken(
  token: string | null,
  opts: { projectId: string; emulator: boolean; keys: KeySource; nowMs?: number },
): Promise<VerifiedCaller> {
  const unauthenticated = () => new ApiError('unauthenticated', 'Sign in first.');
  if (!token) throw unauthenticated();

  let jwt;
  try {
    jwt = decodeJwt(token);
  } catch {
    throw unauthenticated();
  }

  if (!opts.emulator) {
    const { alg, kid } = jwt.header;
    if (alg !== 'RS256' || typeof kid !== 'string') throw unauthenticated();
    const key = await opts.keys(kid);
    if (!key || !(await verifyRs256(jwt, key))) throw unauthenticated();
  }

  const now = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const { aud, iss, sub, exp, iat, email, picture } = jwt.payload;
  const valid =
    aud === opts.projectId &&
    iss === `https://securetoken.google.com/${opts.projectId}` &&
    typeof sub === 'string' &&
    sub.length > 0 &&
    sub.length <= 128 &&
    typeof exp === 'number' &&
    exp > now - SKEW_SECONDS &&
    typeof iat === 'number' &&
    iat <= now + SKEW_SECONDS;
  if (!valid) throw unauthenticated();

  return {
    uid: sub,
    email: typeof email === 'string' ? email : null,
    picture: typeof picture === 'string' ? picture : null,
  };
}

/** Verifies a Google ID token's signature and returns its claims (checked by `checkGoogleClaims`). */
export async function verifyGoogleIdTokenSignature(
  token: string,
  keys: KeySource,
): Promise<Record<string, unknown>> {
  const jwt = decodeJwt(token);
  const { alg, kid } = jwt.header;
  if (alg !== 'RS256' || typeof kid !== 'string') throw new Error('Unexpected token header');
  const key = await keys(kid);
  if (!key || !(await verifyRs256(jwt, key))) throw new Error('Invalid token signature');
  return jwt.payload;
}

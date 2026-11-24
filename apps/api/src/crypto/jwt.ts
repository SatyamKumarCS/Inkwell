import { base64Decode, base64UrlDecode, base64UrlEncode, fromUtf8, utf8 } from './encoding';

const RS256 = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  /** `base64url(header).base64url(payload)`, the bytes the signature covers. */
  signingInput: string;
  signature: Uint8Array<ArrayBuffer>;
}

/** Splits and parses a JWT without verifying it. Throws on anything malformed. */
export function decodeJwt(token: string): DecodedJwt {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');
  const [header = '', payload = '', signature = ''] = parts;
  const parse = (segment: string) => {
    const value: unknown = JSON.parse(fromUtf8(base64UrlDecode(segment)));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Malformed JWT');
    }
    return value as Record<string, unknown>;
  };
  return {
    header: parse(header),
    payload: parse(payload),
    signingInput: `${header}.${payload}`,
    signature: base64UrlDecode(signature),
  };
}

export async function signJwtRs256(
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  extraHeader: Record<string, unknown> = {},
): Promise<string> {
  const header = base64UrlEncode(
    utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT', ...extraHeader })),
  );
  const body = base64UrlEncode(utf8(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(RS256, privateKey, utf8(`${header}.${body}`));
  return `${header}.${body}.${base64UrlEncode(signature)}`;
}

export function verifyRs256(jwt: DecodedJwt, publicKey: CryptoKey): Promise<boolean> {
  return crypto.subtle.verify(RS256, publicKey, jwt.signature, utf8(jwt.signingInput));
}

const privateKeys = new Map<string, Promise<CryptoKey>>();

/** Imports a PKCS#8 PEM private key (as in a service-account JSON). Cached per isolate. */
export function importPrivateKeyPem(pem: string): Promise<CryptoKey> {
  let key = privateKeys.get(pem);
  if (!key) {
    const body = pem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s+/g, '');
    key = crypto.subtle.importKey('pkcs8', base64Decode(body), RS256, false, ['sign']);
    privateKeys.set(pem, key);
  }
  return key;
}

export function importRsaPublicJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, RS256, false, ['verify']);
}

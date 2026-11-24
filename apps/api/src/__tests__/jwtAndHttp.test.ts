import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  decodeJwt,
  importPrivateKeyPem,
  importRsaPublicJwk,
  signJwtRs256,
  verifyRs256,
} from '../crypto/jwt';
import type { AppEnv } from '../env';
import { ApiError, bearerToken, errorResponse, readCallableData, resultResponse } from '../http';

const testEnv = env as unknown as AppEnv & { TEST_SERVICE_ACCOUNT_PUBLIC_JWK: string };
const serviceAccount = JSON.parse(testEnv.GOOGLE_SERVICE_ACCOUNT) as { private_key: string };

describe('RS256 JWTs (WebCrypto)', () => {
  it('signs a token that verifies with the matching public key', async () => {
    const key = await importPrivateKeyPem(serviceAccount.private_key);
    const token = await signJwtRs256({ uid: 'ada', iat: 1 }, key, { kid: 'k1' });

    const jwt = decodeJwt(token);
    expect(jwt.header).toEqual({ alg: 'RS256', typ: 'JWT', kid: 'k1' });
    expect(jwt.payload).toEqual({ uid: 'ada', iat: 1 });
    const publicKey = await importRsaPublicJwk(
      JSON.parse(testEnv.TEST_SERVICE_ACCOUNT_PUBLIC_JWK) as JsonWebKey,
    );
    expect(await verifyRs256(jwt, publicKey)).toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const key = await importPrivateKeyPem(serviceAccount.private_key);
    const token = await signJwtRs256({ uid: 'ada' }, key);
    const [header, , signature] = token.split('.');
    const forged = `${header}.${btoa(JSON.stringify({ uid: 'eve' })).replace(/=+$/, '')}.${signature}`;
    const publicKey = await importRsaPublicJwk(
      JSON.parse(testEnv.TEST_SERVICE_ACCOUNT_PUBLIC_JWK) as JsonWebKey,
    );
    expect(await verifyRs256(decodeJwt(forged), publicKey)).toBe(false);
  });

  it.each(['', 'a.b', 'a.b.c.d', 'bm90LWpzb24.e30.'])('rejects malformed token %p', (token) => {
    expect(() => decodeJwt(token)).toThrow();
  });
});

describe('callable envelope', () => {
  it('wraps results', async () => {
    expect(await resultResponse({ ok: 1 }).json()).toEqual({ result: { ok: 1 } });
  });

  it('maps ApiError to the callable error format and HTTP status', async () => {
    const response = errorResponse(
      new ApiError('resource-exhausted', 'Slow down', { reason: 'rate-limited' }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: {
        status: 'RESOURCE_EXHAUSTED',
        message: 'Slow down',
        details: { reason: 'rate-limited' },
      },
    });
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const response = errorResponse(new Error('db password is hunter2'));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('hunter2');
  });

  it('reads `data` from a POST body and rejects other shapes', async () => {
    const post = (body: string) => new Request('https://api/x', { method: 'POST', body });
    expect(await readCallableData(post('{"data":{"email":"a@b.co"}}'))).toEqual({
      email: 'a@b.co',
    });
    expect(await readCallableData(post('{}'))).toBeNull();
    await expect(readCallableData(post('not json'))).rejects.toBeInstanceOf(ApiError);
    await expect(readCallableData(new Request('https://api/x'))).rejects.toBeInstanceOf(ApiError);
  });

  it('extracts bearer tokens', () => {
    const req = (auth?: string) =>
      new Request('https://api/x', { headers: auth ? { authorization: auth } : {} });
    expect(bearerToken(req('Bearer abc.def'))).toBe('abc.def');
    expect(bearerToken(req('Basic abc'))).toBeNull();
    expect(bearerToken(req())).toBeNull();
  });
});

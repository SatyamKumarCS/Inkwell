import { afterEach, describe, expect, it, vi } from 'vitest';

import { decodeJwt, importRsaPublicJwk, verifyRs256 } from '../crypto/jwt';
import { getAccessToken, refreshAccessToken, type TokenStore } from '../google/accessToken';
import { handleScheduled } from '../index';
import { config, freshGuard, testEnv } from './helpers';

const MINUTE = 60 * 1000;

/** An in-memory stand-in for the AuthGuard's token table. */
function memoryStore(): TokenStore & { rows: Map<string, { token: string; expiresAtMs: number }> } {
  const rows = new Map<string, { token: string; expiresAtMs: number }>();
  return {
    rows,
    getToken: (key, nowMs) => {
      const row = rows.get(key);
      return Promise.resolve(row && row.expiresAtMs > nowMs ? row.token : null);
    },
    putToken: (key, token, expiresAtMs) => {
      rows.set(key, { token, expiresAtMs });
      return Promise.resolve();
    },
  };
}

/** Fakes Google's token endpoint, returning `ya29.<n>` for the n-th call. */
function fakeTokenEndpoint() {
  let calls = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    calls++;
    return Promise.resolve(Response.json({ access_token: `ya29.${calls}`, expires_in: 3600 }));
  });
}

afterEach(() => vi.restoreAllMocks());

describe('refreshAccessToken', () => {
  it('mints a token signed by the service account when none is stored', async () => {
    const fetch = fakeTokenEndpoint();
    const store = memoryStore();
    const sa = config().serviceAccount;
    const now = Date.UTC(2026, 0, 1);

    expect(await refreshAccessToken(sa, store, 35 * MINUTE, now)).toBe(true);

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const assertion = new URLSearchParams(String(init?.body)).get('assertion') ?? '';
    const jwt = decodeJwt(assertion);
    expect(jwt.payload).toMatchObject({ iss: sa.client_email, aud: sa.token_uri });
    const publicKey = await importRsaPublicJwk(
      JSON.parse(testEnv.TEST_SERVICE_ACCOUNT_PUBLIC_JWK) as JsonWebKey,
    );
    expect(await verifyRs256(jwt, publicKey)).toBe(true);

    // Stored for Google's lifetime minus the 5-minute margin.
    expect([...store.rows.values()]).toEqual([{ token: 'ya29.1', expiresAtMs: now + 55 * MINUTE }]);
  });

  it('keeps a stored token that stays valid long enough, and replaces one that does not', async () => {
    const fetch = fakeTokenEndpoint();
    const store = memoryStore();
    const sa = config().serviceAccount;
    const now = Date.UTC(2026, 0, 1);
    await refreshAccessToken(sa, store, 35 * MINUTE, now);

    // 15 minutes later the token has 40 minutes left: not yet.
    expect(await refreshAccessToken(sa, store, 35 * MINUTE, now + 15 * MINUTE)).toBe(false);
    // 30 minutes later it has 25 left: refresh.
    expect(await refreshAccessToken(sa, store, 35 * MINUTE, now + 30 * MINUTE)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect([...store.rows.values()][0]?.token).toBe('ya29.2');
  });

  it('lets requests use the refreshed token without minting', async () => {
    const fetch = fakeTokenEndpoint();
    const store = memoryStore();
    // A distinct key id keeps this test clear of getAccessToken's per-isolate memory cache.
    const sa = { ...config().serviceAccount, private_key_id: 'refresh-test' };
    const now = Date.UTC(2026, 0, 1);
    await refreshAccessToken(sa, store, 35 * MINUTE, now);

    expect(await getAccessToken(sa, store, now + MINUTE)).toBe('ya29.1');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('handleScheduled', () => {
  it('does nothing with the emulators, which take an admin token', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await handleScheduled(testEnv, freshGuard());
    expect(fetch).not.toHaveBeenCalled();
  });
});

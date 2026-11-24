import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Callables, Collections } from '@inkwell/shared';

import { loadConfig } from '../config';
import type { AppEnv } from '../env';
import { handleRequest } from '../index';
import { firestore, freshGuard, resetEmulators, signInWithCustomToken, testEnv } from './helpers';

const call = (
  path: string,
  data: unknown,
  {
    headers = {},
    guard = freshGuard(),
  }: { headers?: Record<string, string>; guard?: ReturnType<typeof freshGuard> } = {},
) =>
  handleRequest(
    new Request(`http://api.test/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ data }),
    }),
    testEnv,
    guard,
  );

beforeEach(resetEmulators);

describe('HTTP API (callable format)', () => {
  it('answers the health check', async () => {
    const response = await handleRequest(
      new Request('http://api.test/health'),
      testEnv,
      freshGuard(),
    );
    expect(await response.json()).toEqual({ ok: true });
  });

  it('returns NOT_FOUND for unknown routes', async () => {
    const response = await call('nope', {});
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { status: 'NOT_FOUND' } });
  });

  it('runs the full email-code sign-in and profile flow over HTTP', async () => {
    const guard = freshGuard();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const headers = { 'cf-connecting-ip': '203.0.113.7' };

    const requested = await call(
      Callables.requestEmailCode,
      { email: 'Ada@Example.com' },
      { headers, guard },
    );
    expect(await requested.json()).toEqual({ result: { resendAfterSeconds: 60 } });

    // In emulator mode the code is logged, never emailed.
    const logged = String(log.mock.calls.at(-1)?.[0]);
    const code = /Sign-in code for ada@example\.com: (\d{6})/.exec(logged)?.[1];
    expect(code).toBeDefined();
    log.mockRestore();

    const wrong = await call(
      Callables.verifyEmailCode,
      { email: 'ada@example.com', code: code === '000000' ? '111111' : '000000' },
      { guard },
    );
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({
      error: { status: 'INVALID_ARGUMENT', details: { reason: 'invalid-code', attemptsLeft: 4 } },
    });

    const verified = await call(
      Callables.verifyEmailCode,
      { email: 'ada@example.com', code },
      { guard },
    );
    const { result } = (await verified.json()) as { result: { token: string } };
    const idToken = await signInWithCustomToken(result.token);

    const unauthenticated = await call(Callables.completeProfile, { firstName: 'Ada' }, { guard });
    expect(unauthenticated.status).toBe(401);

    const profile = await call(
      Callables.completeProfile,
      { firstName: 'Ada', lastName: 'Lovelace' },
      { headers: { authorization: `Bearer ${idToken}` }, guard },
    );
    const { result: created } = (await profile.json()) as { result: { spaceId: string } };
    expect(created.spaceId).toMatch(/^[A-Za-z0-9]{20}$/);
    const space = await firestore().get(`${Collections.spaces}/${created.spaceId}`);
    expect(space?.name).toBe('Personal');
  });

  it('rate-limits by CF-Connecting-IP, not by client-supplied headers', async () => {
    const guard = freshGuard();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const limitedEnv: AppEnv = { ...testEnv, AUTH_IP_HOURLY_LIMIT: 2 as never };
    const send = (email: string, headers: Record<string, string>) =>
      handleRequest(
        new Request(`http://api.test/${Callables.requestEmailCode}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: { email } }),
        }),
        limitedEnv,
        guard,
      );
    const ip = { 'cf-connecting-ip': '203.0.113.50' };
    expect((await send('a@example.com', ip)).status).toBe(200);
    expect((await send('b@example.com', { ...ip, 'x-forwarded-for': '198.51.100.1' })).status).toBe(
      200,
    );
    const blocked = await send('c@example.com', { ...ip, 'x-forwarded-for': '198.51.100.2' });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: { details: { reason: 'rate-limited' } } });
    vi.restoreAllMocks();
  });

  it('never exposes configuration problems to callers', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken: AppEnv = { ...testEnv, GOOGLE_SERVICE_ACCOUNT: 'not json' };
    const response = await handleRequest(
      new Request(`http://api.test/${Callables.requestEmailCode}`, {
        method: 'POST',
        body: JSON.stringify({ data: { email: 'a@example.com' } }),
      }),
      broken,
      freshGuard(),
    );
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('GOOGLE_SERVICE_ACCOUNT');
    error.mockRestore();
  });
});

describe('loadConfig guard', () => {
  it('refuses emulators with a real project, and a demo project without emulators', () => {
    expect(() => loadConfig({ ...testEnv, FIREBASE_PROJECT_ID: 'inkwell-prod' as never })).toThrow(
      /real/,
    );
    expect(() =>
      loadConfig({ ...testEnv, FIRESTORE_EMULATOR_HOST: '', FIREBASE_AUTH_EMULATOR_HOST: '' }),
    ).toThrow(/demo project/);
    expect(() => loadConfig({ ...testEnv, FIREBASE_AUTH_EMULATOR_HOST: '' })).toThrow(/both/);
  });

  it('reports missing secrets and invalid limits', () => {
    expect(() =>
      loadConfig({ ...testEnv, OTP_PEPPER: '', EMAIL_CODE_TTL_SECONDS: 'soon' as never }),
    ).toThrow(
      'Invalid API configuration: EMAIL_CODE_TTL_SECONDS must be a positive integer; ' +
        'OTP_PEPPER secret is not set',
    );
    expect(() =>
      loadConfig({ ...testEnv, GOOGLE_SERVICE_ACCOUNT: '{"client_email":"x"}' }),
    ).toThrow('GOOGLE_SERVICE_ACCOUNT is not a service-account key.');
  });

  it('accepts numeric strings for limits and defaults the token URI', () => {
    const parsed = loadConfig({ ...testEnv, AUTH_IP_HOURLY_LIMIT: '7' as never });
    expect(parsed.limits.ipPerHour).toBe(7);
    expect(parsed.serviceAccount.token_uri).toBe('https://oauth2.googleapis.com/token');
  });

  it('accepts a real project without emulators', () => {
    const prod = loadConfig({
      ...testEnv,
      FIREBASE_PROJECT_ID: 'inkwell-prod' as never,
      FIRESTORE_EMULATOR_HOST: '',
      FIREBASE_AUTH_EMULATOR_HOST: '',
    });
    expect(prod.emulators).toBeNull();
    expect(prod.projectId).toBe('inkwell-prod');
  });
});

import { runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailCodePolicy } from '@inkwell/shared';

import { requestEmailCode, verifyEmailCode, type RequestEmailCodeDeps } from '../auth/emailCode';
import type { Guard } from '../auth/guard';
import {
  clock,
  config,
  customTokenUid,
  expectAuthError,
  freshGuard,
  identityToolkit,
  listUsers,
  PEPPER,
  resetEmulators,
  testEnv,
} from './helpers';

const MINUTE = 60_000;

let time: ReturnType<typeof clock>;
let guard: Guard;
let sent: { email: string; code: string }[];

function deps(overrides: Partial<RequestEmailCodeDeps> = {}): RequestEmailCodeDeps {
  return {
    guard,
    pepper: PEPPER,
    ipKey: '198.51.100.1',
    limits: { ttlSeconds: 600, ipPerHour: 10, dailyCap: 200 },
    now: time.now,
    sendCode: async (email, code) => {
      sent.push({ email, code });
    },
    ...overrides,
  };
}

const verify = (email: string, code: string) =>
  verifyEmailCode(
    { email, code },
    {
      guard,
      idt: identityToolkit(),
      pepper: PEPPER,
      serviceAccount: config().serviceAccount,
      now: time.now,
    },
  );

function lastSent() {
  const last = sent.at(-1);
  if (!last) throw new Error('No code was sent');
  return last;
}

/** Requests a code and returns it. */
async function sendCode(email: string, overrides: Partial<RequestEmailCodeDeps> = {}) {
  await requestEmailCode({ email }, deps(overrides));
  return lastSent().code;
}

beforeEach(async () => {
  await resetEmulators();
  time = clock();
  guard = freshGuard();
  sent = [];
});

describe('requestEmailCode', () => {
  it('sends the code to the normalised email and returns the resend delay', async () => {
    const result = await requestEmailCode({ email: ' Ada@Example.com ' }, deps());

    expect(result).toEqual({ resendAfterSeconds: EmailCodePolicy.resendCooldownSeconds });
    expect(sent).toHaveLength(1);
    expect(lastSent().email).toBe('ada@example.com');
    expect(lastSent().code).toMatch(/^\d{6}$/);
  });

  it('stores only a keyed hash of the code, under a hash of the email', async () => {
    const stub = testEnv.AUTH_GUARD.get(testEnv.AUTH_GUARD.idFromName('hash-check'));
    const code = await sendCode('ada@example.com', { guard: stub });

    const rows = await runInDurableObject(stub, (_instance, state) =>
      state.storage.sql.exec('SELECT * FROM email_codes').toArray(),
    );
    expect(rows).toHaveLength(1);
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain(code);
    expect(stored).not.toContain('ada@example.com');
    expect(rows[0]?.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects an invalid email', async () => {
    await expectAuthError(requestEmailCode({ email: 'nope' }, deps()), 'invalid-email');
  });

  it('enforces the resend cooldown', async () => {
    await sendCode('ada@example.com');
    time.advance(20_000);
    await expectAuthError(requestEmailCode({ email: 'ada@example.com' }, deps()), 'rate-limited', {
      retryAfterSeconds: 40,
    });
    time.advance(40_000);
    await expect(requestEmailCode({ email: 'ada@example.com' }, deps())).resolves.toBeDefined();
  });

  it('caps sends per email per hour', async () => {
    for (let i = 0; i < EmailCodePolicy.maxSendsPerHour; i++) {
      await sendCode('ada@example.com');
      time.advance(MINUTE + 1000);
    }
    await expectAuthError(requestEmailCode({ email: 'ada@example.com' }, deps()), 'rate-limited');
  });

  it('caps sends per IP across different emails', async () => {
    const limits = { ttlSeconds: 600, ipPerHour: 3, dailyCap: 200 };
    for (let i = 0; i < 3; i++) await sendCode(`user${i}@example.com`, { limits });
    await expectAuthError(
      requestEmailCode({ email: 'user9@example.com' }, deps({ limits })),
      'rate-limited',
    );
    // Another IP is unaffected.
    await expect(
      requestEmailCode({ email: 'user9@example.com' }, deps({ limits, ipKey: '203.0.113.9' })),
    ).resolves.toBeDefined();
  });

  it('stops all sends once the global daily cap is reached', async () => {
    const limits = { ttlSeconds: 600, ipPerHour: 10, dailyCap: 2 };
    await sendCode('a@example.com', { limits, ipKey: '203.0.113.1' });
    await sendCode('b@example.com', { limits, ipKey: '203.0.113.2' });
    await expectAuthError(
      requestEmailCode({ email: 'c@example.com' }, deps({ limits, ipKey: '203.0.113.3' })),
      'daily-limit',
    );
    expect(sent).toHaveLength(2);
  });

  it('without a reliable IP: skips the per-IP limit (no shared bucket), keeps the daily cap, warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const limits = { ttlSeconds: 600, ipPerHour: 1, dailyCap: 3 };
    for (const name of ['a', 'b', 'c']) {
      await sendCode(`${name}@example.com`, { limits, ipKey: null });
    }
    expect(sent).toHaveLength(3); // ipPerHour: 1 did not apply
    await expectAuthError(
      requestEmailCode({ email: 'd@example.com' }, deps({ limits, ipKey: null })),
      'daily-limit',
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('per-IP limit'));
    warn.mockRestore();
  });

  it('lets the user retry straight away when the email fails to send', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('Resend is down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expectAuthError(
      requestEmailCode({ email: 'ada@example.com' }, deps({ sendCode: failing })),
      'send-failed',
    );
    await expect(requestEmailCode({ email: 'ada@example.com' }, deps())).resolves.toBeDefined();
    error.mockRestore();
  });
});

describe('verifyEmailCode', () => {
  it('creates a verified account on first sign-in and returns its custom token', async () => {
    const code = await sendCode('ada@example.com');
    const { token } = await verify('ada@example.com', code);

    const users = await listUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: 'ada@example.com', emailVerified: true });
    expect(customTokenUid(token)).toBe(users[0]?.localId);
  });

  it('signs a returning user into the same account, whatever the email casing', async () => {
    const first = await verify('ada@example.com', await sendCode('ada@example.com'));
    time.advance(MINUTE + 1000);
    const second = await verify('ADA@example.com ', await sendCode('Ada@Example.com'));

    expect(customTokenUid(second.token)).toBe(customTokenUid(first.token));
    expect(await listUsers()).toHaveLength(1);
  });

  it('one email = one account: lands in an existing Google account with the same email', async () => {
    const idt = identityToolkit();
    const google = await idt.createUser('ada@example.com');
    await idt.linkProvider(google.uid, {
      providerId: 'google.com',
      rawId: 'google-sub-123',
      email: 'ada@example.com',
    });

    const { token } = await verify('ada@example.com', await sendCode('ada@example.com'));

    expect(customTokenUid(token)).toBe(google.uid);
    const users = await listUsers();
    expect(users).toHaveLength(1);
    expect(users[0]?.providerUserInfo?.map((p) => p.providerId)).toContain('google.com');
  });

  it('marks an existing unverified account as verified', async () => {
    const response = await fetch(
      `http://${testEnv.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/projects/demo-inkwell/accounts`,
      {
        method: 'POST',
        headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'ada@example.com', emailVerified: false }),
      },
    );
    const { localId } = (await response.json()) as { localId: string };

    const { token } = await verify('ada@example.com', await sendCode('ada@example.com'));

    expect(customTokenUid(token)).toBe(localId);
    expect((await listUsers())[0]?.emailVerified).toBe(true);
  });

  it('rejects a wrong code and counts down the attempts left', async () => {
    await sendCode('ada@example.com');
    await expectAuthError(verify('ada@example.com', '000000'), 'invalid-code', {
      attemptsLeft: EmailCodePolicy.maxAttempts - 1,
    });
  });

  it('locks the code after too many wrong attempts, even for the right code', async () => {
    const code = await sendCode('ada@example.com');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 1; i < EmailCodePolicy.maxAttempts; i++) {
      await expectAuthError(verify('ada@example.com', wrong), 'invalid-code');
    }
    await expectAuthError(verify('ada@example.com', wrong), 'too-many-attempts');
    await expectAuthError(verify('ada@example.com', code), 'code-expired');
  });

  it('rejects an expired code', async () => {
    const code = await sendCode('ada@example.com');
    time.advance(10 * MINUTE);
    await expectAuthError(verify('ada@example.com', code), 'code-expired');
  });

  it('accepts a code only once', async () => {
    const code = await sendCode('ada@example.com');
    await verify('ada@example.com', code);
    await expectAuthError(verify('ada@example.com', code), 'code-expired');
  });

  it('only accepts the latest code after a resend', async () => {
    const first = await sendCode('ada@example.com');
    time.advance(MINUTE + 1000);
    const second = await sendCode('ada@example.com', { generateCode: () => '424242' });
    expect(second).toBe('424242');
    if (first !== second) await expectAuthError(verify('ada@example.com', first), 'invalid-code');
    await expect(verify('ada@example.com', second)).resolves.toHaveProperty('token');
  });

  it('treats an email with no pending code as expired', async () => {
    await expectAuthError(verify('nobody@example.com', '123456'), 'code-expired');
  });
});

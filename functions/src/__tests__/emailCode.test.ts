import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Collections, EmailCodePolicy } from '@inkwell/shared';

import { emailKey } from '../auth/codes';
import { requestEmailCode, type RequestEmailCodeDeps } from '../auth/requestEmailCode';
import { verifyEmailCode } from '../auth/verifyEmailCode';
import { clock, customTokenUid, expectAuthError, resetEmulators } from './helpers';

const db = getFirestore();
const auth = getAuth();
const PEPPER = 'test-pepper';
const MINUTE = 60_000;

let time: ReturnType<typeof clock>;
let sent: { email: string; code: string }[];

function deps(overrides: Partial<RequestEmailCodeDeps> = {}): RequestEmailCodeDeps {
  return {
    db,
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
  verifyEmailCode({ email, code }, { db, auth, pepper: PEPPER, now: time.now });

/** The most recently sent email. */
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
  sent = [];
});

describe('requestEmailCode', () => {
  it('stores only a hash of the code and sends the code', async () => {
    const result = await requestEmailCode({ email: ' Ada@Example.com ' }, deps());

    expect(result).toEqual({ resendAfterSeconds: EmailCodePolicy.resendCooldownSeconds });
    expect(sent).toHaveLength(1);
    expect(lastSent().email).toBe('ada@example.com');
    const stored = await db.doc(`${Collections.emailCodes}/${emailKey('ada@example.com')}`).get();
    expect(stored.get('codeHash')).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored.data())).not.toContain(lastSent().code);
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
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const limits = { ttlSeconds: 600, ipPerHour: 1, dailyCap: 3 };
    for (const name of ['a', 'b', 'c']) {
      await sendCode(`${name}@example.com`, { limits, ipKey: null });
    }

    expect(sent).toHaveLength(3); // ipPerHour: 1 did not apply
    const ipDocs = await db.collection(Collections.rateLimits).get();
    expect(ipDocs.docs.map((d) => d.id).filter((id) => id.startsWith('ip-'))).toEqual([]);
    await expectAuthError(
      requestEmailCode({ email: 'd@example.com' }, deps({ limits, ipKey: null })),
      'daily-limit',
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('per-IP limit'));
    warn.mockRestore();
  });

  it('lets the user retry straight away when the email fails to send', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('Resend is down'));
    await expectAuthError(
      requestEmailCode({ email: 'ada@example.com' }, deps({ sendCode: failing })),
      'send-failed',
    );
    await expect(requestEmailCode({ email: 'ada@example.com' }, deps())).resolves.toBeDefined();
  });
});

describe('verifyEmailCode', () => {
  it('creates a verified account on first sign-in and returns its custom token', async () => {
    const code = await sendCode('ada@example.com');
    const { token } = await verify('ada@example.com', code);

    const user = await auth.getUserByEmail('ada@example.com');
    expect(user.emailVerified).toBe(true);
    expect(customTokenUid(token)).toBe(user.uid);
  });

  it('signs a returning user into the same account, whatever the email casing', async () => {
    const first = await verify('ada@example.com', await sendCode('ada@example.com'));
    time.advance(MINUTE + 1000);
    const second = await verify('ADA@example.com ', await sendCode('Ada@Example.com'));

    expect(customTokenUid(second.token)).toBe(customTokenUid(first.token));
    expect((await auth.listUsers()).users).toHaveLength(1);
  });

  it('one email = one account: lands in an existing Google account with the same email', async () => {
    const google = await auth.createUser({ email: 'ada@example.com', emailVerified: true });
    await auth.updateUser(google.uid, {
      providerToLink: { providerId: 'google.com', uid: 'google-sub-123', email: 'ada@example.com' },
    });

    const { token } = await verify('ada@example.com', await sendCode('ada@example.com'));

    expect(customTokenUid(token)).toBe(google.uid);
    const users = (await auth.listUsers()).users;
    expect(users).toHaveLength(1);
    expect(users[0]?.providerData.map((p) => p.providerId)).toContain('google.com');
  });

  it('marks an existing unverified account as verified', async () => {
    const existing = await auth.createUser({ email: 'ada@example.com', emailVerified: false });
    const { token } = await verify('ada@example.com', await sendCode('ada@example.com'));

    expect(customTokenUid(token)).toBe(existing.uid);
    expect((await auth.getUser(existing.uid)).emailVerified).toBe(true);
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

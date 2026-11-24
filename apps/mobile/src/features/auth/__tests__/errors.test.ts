import { authFailureMessage, toAuthFailure } from '../errors';

describe('toAuthFailure', () => {
  it('reads the reason from HttpsError details', () => {
    expect(
      toAuthFailure({
        code: 'invalid-argument',
        details: { reason: 'invalid-code', attemptsLeft: '2' },
      }),
    ).toEqual({ reason: 'invalid-code', attemptsLeft: 2 });
  });

  it.each([
    'unavailable',
    'functions/unavailable',
    'deadline-exceeded',
    'auth/network-request-failed',
  ])('treats %s as offline', (code) => {
    expect(toAuthFailure({ code })).toEqual({ reason: 'offline' });
  });

  it('falls back to unknown', () => {
    expect(toAuthFailure(new Error('boom'))).toEqual({ reason: 'unknown' });
    expect(toAuthFailure(undefined)).toEqual({ reason: 'unknown' });
  });
});

describe('authFailureMessage', () => {
  it.each([
    [
      { reason: 'invalid-code', attemptsLeft: 3 } as const,
      "That code isn't right. 3 attempts left.",
    ],
    [
      { reason: 'invalid-code', attemptsLeft: 1 } as const,
      "That code isn't right. 1 attempt left.",
    ],
    [{ reason: 'code-expired' } as const, 'This code has expired. Send a new one.'],
    [{ reason: 'too-many-attempts' } as const, 'Too many wrong codes. Send a new one.'],
    [
      { reason: 'rate-limited', retryAfterSeconds: 42 } as const,
      'Too many requests. Try again in 42 seconds.',
    ],
    [
      { reason: 'rate-limited', retryAfterSeconds: 61 } as const,
      'Too many requests. Try again in 2 minutes.',
    ],
    [{ reason: 'offline' } as const, "You're offline. Connect to the internet and try again."],
  ])('%j', (failure, message) => {
    expect(authFailureMessage(failure)).toBe(message);
  });
});

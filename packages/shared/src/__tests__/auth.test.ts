import { describe, expect, it } from 'vitest';
import {
  authErrorDetailsSchema,
  completeProfileRequestSchema,
  fullName,
  requestEmailCodeRequestSchema,
  verifyEmailCodeRequestSchema,
} from '../index';

describe('auth contracts', () => {
  it('normalises the email address', () => {
    expect(requestEmailCodeRequestSchema.parse({ email: '  Ada@Example.COM ' })).toEqual({
      email: 'ada@example.com',
    });
  });

  it.each(['', 'not-an-email', 'a@', '@b.com'])('rejects %p as an email', (email) => {
    expect(requestEmailCodeRequestSchema.safeParse({ email }).success).toBe(false);
  });

  it.each([
    ['123456', true],
    [' 123456 ', true],
    ['12345', false],
    ['1234567', false],
    ['12a456', false],
  ])('code %p valid=%p', (code, valid) => {
    expect(verifyEmailCodeRequestSchema.safeParse({ email: 'a@b.co', code }).success).toBe(valid);
  });

  it('trims names and defaults the last name', () => {
    expect(completeProfileRequestSchema.parse({ firstName: ' Ada ' })).toEqual({
      firstName: 'Ada',
      lastName: '',
    });
    expect(completeProfileRequestSchema.safeParse({ firstName: '   ' }).success).toBe(false);
  });

  it('coerces numeric error details that arrive as strings', () => {
    expect(authErrorDetailsSchema.parse({ reason: 'invalid-code', attemptsLeft: '3' })).toEqual({
      reason: 'invalid-code',
      attemptsLeft: 3,
    });
    expect(authErrorDetailsSchema.safeParse({ reason: 'nope' }).success).toBe(false);
  });

  it('joins full names', () => {
    expect(fullName('Ada', 'Lovelace')).toBe('Ada Lovelace');
    expect(fullName(' Ada ', '')).toBe('Ada');
  });
});

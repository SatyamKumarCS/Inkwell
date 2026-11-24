import { describe, expect, it } from 'vitest';

import { clientIp, codesMatch, emailKey, generateCode, hashCode, ipBucket } from '../auth/codes';
import { checkWindow } from '../auth/rateWindow';

describe('codes', () => {
  it('generates 6-digit codes, keeping leading zeros', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it('hashes per pepper and email', () => {
    const base = hashCode('pepper', 'a@b.co', '123456');
    expect(hashCode('pepper', 'a@b.co', '123456')).toBe(base);
    expect(hashCode('other', 'a@b.co', '123456')).not.toBe(base);
    expect(hashCode('pepper', 'c@d.co', '123456')).not.toBe(base);
    expect(codesMatch(base, hashCode('pepper', 'a@b.co', '123456'))).toBe(true);
    expect(codesMatch(base, hashCode('pepper', 'a@b.co', '654321'))).toBe(false);
  });

  it('keys docs by a hash, never the raw email', () => {
    expect(emailKey('a@b.co')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('clientIp', () => {
  it('uses the last X-Forwarded-For entry (the one Google appended)', () => {
    expect(clientIp({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' })).toBe('203.0.113.7');
    expect(clientIp({ 'x-forwarded-for': ['6.6.6.6', '203.0.113.7'] })).toBe('203.0.113.7');
    expect(clientIp({ 'x-forwarded-for': '2001:db8::1' })).toBe('2001:db8::1');
  });

  it.each([
    ['no header', {}],
    ['an empty header', { 'x-forwarded-for': ' , ' }],
    ['garbage', { 'x-forwarded-for': 'not-an-ip' }],
    ['loopback', { 'x-forwarded-for': '127.0.0.1' }],
    ['a private address', { 'x-forwarded-for': '203.0.113.7, 10.1.2.3' }],
    ['a LAN address', { 'x-forwarded-for': '192.168.1.20' }],
    ['link-local', { 'x-forwarded-for': '169.254.1.1' }],
    ['carrier-grade NAT', { 'x-forwarded-for': '100.64.0.1' }],
    ['IPv6 loopback', { 'x-forwarded-for': '::1' }],
    ['IPv6 unique-local', { 'x-forwarded-for': 'fd12:3456::1' }],
    ['IPv6 link-local', { 'x-forwarded-for': 'fe80::1' }],
    ['IPv4-mapped private', { 'x-forwarded-for': '::ffff:10.0.0.1' }],
  ])('returns null (not one shared bucket) for %s', (_label, headers) => {
    expect(clientIp(headers)).toBeNull();
  });
});

describe('ipBucket', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['2001:db8:85a3:12::8a2e:370:7334', '2001:0db8:85a3:0012::/64'],
    ['2001:DB8::1', '2001:0db8:0000:0000::/64'],
    ['2001:db8:85a3:12:ffff:ffff:ffff:ffff', '2001:0db8:85a3:0012::/64'],
  ])('%s -> %s', (ip, bucket) => {
    expect(ipBucket(ip)).toBe(bucket);
  });
});

describe('checkWindow', () => {
  const HOUR = 3_600_000;

  it('starts a window on the first event', () => {
    expect(checkWindow(undefined, 1000, HOUR, 2)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
      next: { windowStartMs: 1000, count: 1 },
    });
  });

  it('blocks at the limit and reports when the window resets', () => {
    const result = checkWindow({ windowStartMs: 0, count: 2 }, HOUR - 30_000, HOUR, 2);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(30);
  });

  it('starts a fresh window once the old one has passed', () => {
    expect(checkWindow({ windowStartMs: 0, count: 2 }, HOUR, HOUR, 2)).toMatchObject({
      allowed: true,
      next: { windowStartMs: HOUR, count: 1 },
    });
  });
});

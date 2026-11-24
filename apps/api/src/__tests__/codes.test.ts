import { describe, expect, it } from 'vitest';

import {
  callerIpKey,
  clientIp,
  codesMatch,
  emailKey,
  generateCode,
  hashCode,
  ipBucket,
  isPublicIp,
  parseIPv6,
} from '../auth/codes';
import { checkWindow } from '../auth/rateWindow';

const headers = (init: Record<string, string>) => new Headers(init);

describe('codes', () => {
  it('generates 6-digit codes, keeping leading zeros', () => {
    for (let i = 0; i < 500; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it('hashes per pepper and email', async () => {
    const base = await hashCode('pepper', 'a@b.co', '123456');
    expect(await hashCode('pepper', 'a@b.co', '123456')).toBe(base);
    expect(await hashCode('other', 'a@b.co', '123456')).not.toBe(base);
    expect(await hashCode('pepper', 'c@d.co', '123456')).not.toBe(base);
    expect(codesMatch(base, await hashCode('pepper', 'a@b.co', '123456'))).toBe(true);
    expect(codesMatch(base, await hashCode('pepper', 'a@b.co', '654321'))).toBe(false);
  });

  it('keys records by a hash, never the raw email', async () => {
    expect(await emailKey('a@b.co')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('clientIp (Cloudflare)', () => {
  it('uses CF-Connecting-IP', () => {
    expect(clientIp(headers({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(headers({ 'cf-connecting-ip': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('ignores client-supplied forwarding headers', () => {
    expect(
      clientIp(headers({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '203.0.113.7' })),
    ).toBeNull();
  });

  it.each([
    ['no header (local dev)', {}],
    ['garbage', { 'cf-connecting-ip': 'not-an-ip' }],
    ['loopback', { 'cf-connecting-ip': '127.0.0.1' }],
    ['a private address', { 'cf-connecting-ip': '10.1.2.3' }],
    ['a LAN address', { 'cf-connecting-ip': '192.168.1.20' }],
    ['link-local', { 'cf-connecting-ip': '169.254.1.1' }],
    ['carrier-grade NAT', { 'cf-connecting-ip': '100.64.0.1' }],
    ['IPv6 loopback', { 'cf-connecting-ip': '::1' }],
    ['IPv6 unique-local', { 'cf-connecting-ip': 'fd12:3456::1' }],
    ['IPv6 link-local', { 'cf-connecting-ip': 'fe80::1' }],
    ['IPv4-mapped private', { 'cf-connecting-ip': '::ffff:10.0.0.1' }],
  ])('returns null (not one shared bucket) for %s', (_label, init) => {
    expect(clientIp(headers(init))).toBeNull();
    expect(callerIpKey(headers(init))).toBeNull();
  });
});

describe('IP parsing', () => {
  it.each([
    ['2001:db8::1', ['2001', 'db8', '0', '0', '0', '0', '0', '1']],
    ['::', ['0', '0', '0', '0', '0', '0', '0', '0']],
    ['::ffff:1.2.3.4', ['0', '0', '0', '0', '0', 'ffff', '102', '304']],
  ])('parses %s', (ip, groups) => {
    expect(parseIPv6(ip)).toEqual(groups);
  });

  it.each(['1.2.3.4', '2001:db8::1::2', '2001:db8:1:2:3:4:5:6:7', 'gggg::1', '::ffff:1.2.3.999'])(
    'rejects %s as IPv6',
    (ip) => {
      expect(parseIPv6(ip)).toBeNull();
    },
  );

  it.each([
    ['8.8.8.8', true],
    ['2606:4700::1111', true],
    ['::ffff:8.8.8.8', true],
    ['172.16.0.1', false],
    ['172.32.0.1', true],
    ['224.0.0.1', false],
  ])('isPublicIp(%s) = %s', (ip, expected) => {
    expect(isPublicIp(ip)).toBe(expected);
  });

  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['2001:db8:85a3:12::8a2e:370:7334', '2001:0db8:85a3:0012::/64'],
    ['2001:DB8::1', '2001:0db8:0000:0000::/64'],
    ['2001:db8:85a3:12:ffff:ffff:ffff:ffff', '2001:0db8:85a3:0012::/64'],
  ])('buckets %s as %s', (ip, bucket) => {
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

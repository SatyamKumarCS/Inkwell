import { EMAIL_CODE_LENGTH } from '@inkwell/shared';

import { hmacSha256Hex, sha256Hex, timingSafeEqualHex } from '../crypto/hash';

/** Uniformly random 6-digit code (rejection sampling avoids modulo bias). */
export function generateCode(): string {
  const range = 10 ** EMAIL_CODE_LENGTH;
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] ?? limit;
  } while (value >= limit);
  return (value % range).toString().padStart(EMAIL_CODE_LENGTH, '0');
}

/** Keyed hash so leaked code records can't be brute-forced offline without the pepper. */
export const hashCode = (pepper: string, email: string, code: string) =>
  hmacSha256Hex(pepper, `${email}:${code}`);

export const codesMatch = (storedHash: string, candidateHash: string) =>
  timingSafeEqualHex(storedHash, candidateHash);

/** Record key for an (already normalised) email, so addresses are never stored in clear. */
export const emailKey = (email: string) => sha256Hex(email);

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export const isIPv4 = (ip: string) => IPV4.test(ip);

/** The 8 hextets of an IPv6 address (lower-case, unpadded), or null if it isn't valid IPv6. */
export function parseIPv6(ip: string): string[] | null {
  let text = ip.toLowerCase();
  if (!text.includes(':')) return null;
  // Embedded IPv4 tail (e.g. ::ffff:1.2.3.4) becomes two hextets.
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    if (!isIPv4(tail)) return null;
    const [a = 0, b = 0, c = 0, d = 0] = tail.split('.').map(Number);
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(Math.max(missing, 0)).fill('0'), ...rest];
  return groups.every((g) => /^[0-9a-f]{1,4}$/.test(g)) ? groups : null;
}

function ipv4IsPublic(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast and reserved
  );
}

/** Loopback, private, link-local and similar addresses never identify an internet client. */
export function isPublicIp(ip: string): boolean {
  if (isIPv4(ip)) return ipv4IsPublic(ip);
  const groups = parseIPv6(ip);
  if (!groups) return false;
  const first = parseInt(groups[0] ?? '0', 16);
  if (groups.slice(0, 5).every((g) => g === '0') && groups[5] === 'ffff') {
    // IPv4-mapped (::ffff:a.b.c.d)
    const hi = parseInt(groups[6] ?? '0', 16);
    const lo = parseInt(groups[7] ?? '0', 16);
    return ipv4IsPublic(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  const allZero = groups.every((g) => g === '0');
  const loopback = groups.slice(0, 7).every((g) => g === '0') && groups[7] === '1';
  const uniqueLocal = (first & 0xfe00) === 0xfc00; // fc00::/7
  const linkLocal = (first & 0xffc0) === 0xfe80; // fe80::/10
  return !(allZero || loopback || uniqueLocal || linkLocal);
}

/**
 * The caller's public IP, or null when it can't be determined reliably. Cloudflare sets
 * `CF-Connecting-IP` at the edge and overwrites any client-supplied value; it is absent in local dev.
 */
export function clientIp(headers: Headers): string | null {
  const ip = headers.get('cf-connecting-ip')?.trim();
  return ip && isPublicIp(ip) ? ip : null;
}

/**
 * Rate-limit bucket for an IP. IPv6 users usually control a whole /64, so per-address limits would be
 * trivial to dodge; bucket by the /64 prefix instead.
 */
export function ipBucket(ip: string): string {
  if (isIPv4(ip)) return ip;
  const groups = parseIPv6(ip);
  if (!groups) return ip;
  if (groups.slice(0, 5).every((g) => g === '0') && groups[5] === 'ffff') {
    const hi = parseInt(groups[6] ?? '0', 16);
    const lo = parseInt(groups[7] ?? '0', 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return `${groups
    .slice(0, 4)
    .map((g) => g.padStart(4, '0'))
    .join(':')}::/64`;
}

/** Rate-limit key for the caller, or null when their IP can't be determined reliably. */
export function callerIpKey(headers: Headers): string | null {
  const ip = clientIp(headers);
  return ip ? ipBucket(ip) : null;
}

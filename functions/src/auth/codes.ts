import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { isIPv4, isIPv6 } from 'node:net';
import { EMAIL_CODE_LENGTH } from '@inkwell/shared';

export function generateCode(): string {
  return randomInt(0, 10 ** EMAIL_CODE_LENGTH)
    .toString()
    .padStart(EMAIL_CODE_LENGTH, '0');
}

/** Keyed hash so a leaked `emailCodes` doc can't be brute-forced offline without the pepper. */
export function hashCode(pepper: string, email: string, code: string): string {
  return createHmac('sha256', pepper).update(`${email}:${code}`).digest('hex');
}

export function codesMatch(storedHash: string, candidateHash: string): boolean {
  const a = Buffer.from(storedHash, 'hex');
  const b = Buffer.from(candidateHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Document ID for an (already normalised) email, so addresses never appear in document paths. */
export const emailKey = (email: string) => sha256(email);

/**
 * The caller's IP from a Cloud Run request. Google's front end appends the connecting address as the
 * last `X-Forwarded-For` entry; earlier entries are client-supplied and can be spoofed.
 */
export function clientIp(
  headers: Record<string, string | string[] | undefined>,
  fallback?: string,
): string | null {
  const header = headers['x-forwarded-for'];
  const value = Array.isArray(header) ? header.join(',') : header;
  const last = value
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  return last || fallback || null;
}

/**
 * Rate-limit bucket for an IP. IPv6 users usually control a whole /64, so per-address limits would be
 * trivial to dodge; bucket by the /64 prefix instead.
 */
export function ipBucket(ip: string): string {
  const mapped = ip.toLowerCase().startsWith('::ffff:') ? ip.slice(7) : null;
  if (mapped && isIPv4(mapped)) return mapped;
  if (!isIPv6(ip)) return ip;

  const [head = '', tail = ''] = ip.toLowerCase().split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? [
        ...headGroups,
        ...Array<string>(8 - headGroups.length - tailGroups.length).fill('0'),
        ...tailGroups,
      ]
    : headGroups;
  return `${groups
    .slice(0, 4)
    .map((group) => group.padStart(4, '0'))
    .join(':')}::/64`;
}

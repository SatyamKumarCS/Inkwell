import { Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { Collections, rateLimitSchema, timestampToMillis, type RateWindow } from '@inkwell/shared';

import { sha256 } from './codes';
import { checkWindow, type Window, type WindowCheck } from './rateWindow';

export const HOUR_MS = 60 * 60 * 1000;

/** Each action keeps its own per-IP counter, with the same hourly limit. */
export type IpLimitScope = 'email' | 'google';

export function ipLimitRef(db: Firestore, scope: IpLimitScope, ipKey: string): DocumentReference {
  return db.collection(Collections.rateLimits).doc(`ip-${scope}-${sha256(ipKey)}`);
}

export const toWindow = (window: RateWindow | undefined): Window | undefined =>
  window && { windowStartMs: timestampToMillis(window.windowStart), count: window.count };

export const ipLimitDoc = (next: Window) => ({
  windowStart: Timestamp.fromMillis(next.windowStartMs),
  count: next.count,
  purgeAt: Timestamp.fromMillis(next.windowStartMs + HOUR_MS),
});

export function warnUnknownIp(action: string) {
  logger.warn(
    `${action}: caller IP could not be determined reliably; skipping the per-IP limit ` +
      '(global limits still apply)',
  );
}

/**
 * Counts one request against the caller's IP bucket. Without a reliable IP the per-IP limit is skipped
 * (with a warning) rather than putting every caller in one shared bucket.
 */
export async function consumeIpLimit(
  db: Firestore,
  opts: { scope: IpLimitScope; ipKey: string | null; perHour: number; nowMs: number },
): Promise<WindowCheck | null> {
  if (!opts.ipKey) {
    warnUnknownIp(opts.scope);
    return null;
  }
  const ref = ipLimitRef(db, opts.scope, opts.ipKey);
  return db.runTransaction(async (tx) => {
    const current = rateLimitSchema.safeParse((await tx.get(ref)).data()).data;
    const check = checkWindow(toWindow(current), opts.nowMs, HOUR_MS, opts.perHour);
    if (check.allowed) tx.set(ref, ipLimitDoc(check.next));
    return check;
  });
}

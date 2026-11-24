import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import {
  Collections,
  EmailCodePolicy,
  emailCodeRecordSchema,
  rateLimitSchema,
  requestEmailCodeRequestSchema,
  timestampToMillis,
  type RequestEmailCodeResponse,
} from '@inkwell/shared';

import { emailKey, generateCode, hashCode } from './codes';
import { authError } from './errors';
import { HOUR_MS, ipLimitDoc, ipLimitRef, toWindow, warnUnknownIp } from './ipLimit';
import { checkWindow, type Window } from './rateWindow';

const DAY_MS = 24 * HOUR_MS;

export interface EmailCodeLimits {
  ttlSeconds: number;
  /** Max sends per IP bucket per hour, across all emails. */
  ipPerHour: number;
  /** Max sends per UTC day across the whole project. */
  dailyCap: number;
}

export interface RequestEmailCodeDeps {
  db: Firestore;
  pepper: string;
  limits: EmailCodeLimits;
  /**
   * Rate-limit bucket for the caller's IP (see `ipBucket`), or null when it can't be determined reliably:
   * then only the per-email limits and the global daily cap apply.
   */
  ipKey: string | null;
  sendCode: (email: string, code: string) => Promise<void>;
  now?: () => Date;
  generateCode?: () => string;
}

type Outcome =
  { ok: true } | { ok: false; reason: 'rate-limited' | 'daily-limit'; retryAfterSeconds: number };

const fromWindow = (window: Window) => ({
  windowStart: Timestamp.fromMillis(window.windowStartMs),
  count: window.count,
});

/**
 * Issues a 6-digit code for an email. Limits, checked in one transaction before anything is written:
 * a resend cooldown and hourly cap per email, an hourly cap per IP bucket, and a global daily cap.
 * The response never reveals whether an account exists for the email.
 */
export async function requestEmailCode(
  input: unknown,
  deps: RequestEmailCodeDeps,
): Promise<RequestEmailCodeResponse> {
  const request = requestEmailCodeRequestSchema.safeParse(input);
  if (!request.success) throw authError('invalid-email', 'Enter a valid email address.');
  const { email } = request.data;

  const now = (deps.now ?? (() => new Date()))().getTime();
  const code = (deps.generateCode ?? generateCode)();
  const { limits, db } = deps;

  const day = new Date(now).toISOString().slice(0, 10);
  const dayStartMs = Date.parse(`${day}T00:00:00.000Z`);
  const codeRef = db.collection(Collections.emailCodes).doc(emailKey(email));
  const dayRef = db.collection(Collections.rateLimits).doc(`daily-${day}`);
  const ipRef = deps.ipKey ? ipLimitRef(db, 'email', deps.ipKey) : null;
  if (!ipRef) warnUnknownIp('requestEmailCode');

  const outcome = await db.runTransaction<Outcome>(async (tx) => {
    const [codeSnap, daySnap, ipSnap] = await Promise.all([
      tx.get(codeRef),
      tx.get(dayRef),
      ipRef ? tx.get(ipRef) : Promise.resolve(null),
    ]);
    const record = emailCodeRecordSchema.safeParse(codeSnap.data()).data;
    const ipLimit = rateLimitSchema.safeParse(ipSnap?.data()).data;
    const dayLimit = rateLimitSchema.safeParse(daySnap.data()).data;

    if (record) {
      const cooldownEndsMs =
        timestampToMillis(record.lastSentAt) + EmailCodePolicy.resendCooldownSeconds * 1000;
      if (now < cooldownEndsMs) {
        return {
          ok: false,
          reason: 'rate-limited',
          retryAfterSeconds: Math.ceil((cooldownEndsMs - now) / 1000),
        };
      }
    }

    const emailWindow = checkWindow(
      toWindow(record?.sends),
      now,
      HOUR_MS,
      EmailCodePolicy.maxSendsPerHour,
    );
    if (!emailWindow.allowed) {
      return {
        ok: false,
        reason: 'rate-limited',
        retryAfterSeconds: emailWindow.retryAfterSeconds,
      };
    }

    const ipWindow = ipRef ? checkWindow(toWindow(ipLimit), now, HOUR_MS, limits.ipPerHour) : null;
    if (ipWindow && !ipWindow.allowed) {
      return { ok: false, reason: 'rate-limited', retryAfterSeconds: ipWindow.retryAfterSeconds };
    }

    const sentToday = dayLimit?.count ?? 0;
    if (sentToday >= limits.dailyCap) {
      return {
        ok: false,
        reason: 'daily-limit',
        retryAfterSeconds: Math.ceil((dayStartMs + DAY_MS - now) / 1000),
      };
    }

    const expiresAtMs = now + limits.ttlSeconds * 1000;
    tx.set(codeRef, {
      codeHash: hashCode(deps.pepper, email, code),
      expiresAt: Timestamp.fromMillis(expiresAtMs),
      attempts: 0,
      lastSentAt: Timestamp.fromMillis(now),
      sends: fromWindow(emailWindow.next),
      purgeAt: Timestamp.fromMillis(
        Math.max(expiresAtMs, emailWindow.next.windowStartMs + HOUR_MS),
      ),
    });
    if (ipRef && ipWindow) tx.set(ipRef, ipLimitDoc(ipWindow.next));
    tx.set(dayRef, {
      windowStart: Timestamp.fromMillis(dayStartMs),
      count: sentToday + 1,
      purgeAt: Timestamp.fromMillis(dayStartMs + 2 * DAY_MS),
    });
    return { ok: true };
  });

  if (!outcome.ok) {
    if (outcome.reason === 'daily-limit') {
      logger.error('requestEmailCode: global daily send cap reached', { cap: limits.dailyCap });
      throw authError('daily-limit', "We can't send sign-in codes right now.", {
        retryAfterSeconds: outcome.retryAfterSeconds,
      });
    }
    throw authError('rate-limited', 'Too many code requests.', {
      retryAfterSeconds: outcome.retryAfterSeconds,
    });
  }

  try {
    await deps.sendCode(email, code);
  } catch (error) {
    logger.error('requestEmailCode: sending the email failed', error);
    // Drop the unsent code and lift the cooldown so the user can retry straight away.
    await codeRef.update({ codeHash: null, lastSentAt: Timestamp.fromMillis(0) });
    throw authError('send-failed', "We couldn't send the email. Please try again.");
  }

  return { resendAfterSeconds: EmailCodePolicy.resendCooldownSeconds };
}

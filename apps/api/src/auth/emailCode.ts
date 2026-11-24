import {
  EmailCodePolicy,
  requestEmailCodeRequestSchema,
  verifyEmailCodeRequestSchema,
  type RequestEmailCodeResponse,
  type VerifyEmailCodeResponse,
} from '@inkwell/shared';

import type { ServiceAccount } from '../config';
import { sha256Hex } from '../crypto/hash';
import type { IdentityToolkit } from '../google/identityToolkit';
import { emailKey, generateCode, hashCode } from './codes';
import { authError } from './errors';
import { warnUnknownIp, type Guard } from './guard';
import { createCustomToken } from './tokens';
import { findOrCreateUserByEmail } from './users';

export interface EmailCodeLimits {
  ttlSeconds: number;
  /** Max sends per IP bucket per hour, across all emails. */
  ipPerHour: number;
  /** Max sends per UTC day across the whole project. */
  dailyCap: number;
}

export interface RequestEmailCodeDeps {
  guard: Guard;
  pepper: string;
  limits: EmailCodeLimits;
  /** Rate-limit bucket for the caller's IP (see `ipBucket`), or null when it can't be determined. */
  ipKey: string | null;
  sendCode: (email: string, code: string) => Promise<void>;
  now?: () => Date;
  generateCode?: () => string;
}

/**
 * Issues a 6-digit code for an email. All limits are checked atomically in the AuthGuard before anything is
 * stored. The response never reveals whether an account exists for the email.
 */
export async function requestEmailCode(
  input: unknown,
  deps: RequestEmailCodeDeps,
): Promise<RequestEmailCodeResponse> {
  const request = requestEmailCodeRequestSchema.safeParse(input);
  if (!request.success) throw authError('invalid-email', 'Enter a valid email address.');
  const { email } = request.data;

  const nowMs = (deps.now ?? (() => new Date()))().getTime();
  const code = (deps.generateCode ?? generateCode)();
  if (!deps.ipKey) warnUnknownIp('requestEmailCode');
  const key = await emailKey(email);

  const outcome = await deps.guard.recordSend({
    emailKey: key,
    codeHash: await hashCode(deps.pepper, email, code),
    ipHash: deps.ipKey ? await sha256Hex(deps.ipKey) : null,
    nowMs,
    ...deps.limits,
  });

  if (!outcome.ok) {
    if (outcome.reason === 'daily-limit') {
      console.error('requestEmailCode: global daily send cap reached', deps.limits.dailyCap);
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
    console.error('requestEmailCode: sending the email failed', error);
    await deps.guard.cancelSend(key);
    throw authError('send-failed', "We couldn't send the email. Please try again.");
  }

  return { resendAfterSeconds: EmailCodePolicy.resendCooldownSeconds };
}

export interface VerifyEmailCodeDeps {
  guard: Guard;
  idt: IdentityToolkit;
  pepper: string;
  serviceAccount: ServiceAccount;
  now?: () => Date;
}

/** Checks a code and returns a Firebase custom token for the account that owns the email. */
export async function verifyEmailCode(
  input: unknown,
  deps: VerifyEmailCodeDeps,
): Promise<VerifyEmailCodeResponse> {
  const request = verifyEmailCodeRequestSchema.safeParse(input);
  if (!request.success) {
    throw authError('invalid-code', 'Enter the 6-digit code from the email.', {
      attemptsLeft: EmailCodePolicy.maxAttempts,
    });
  }
  const { email, code } = request.data;
  const nowMs = (deps.now ?? (() => new Date()))().getTime();

  const outcome = await deps.guard.verify({
    emailKey: await emailKey(email),
    candidateHash: await hashCode(deps.pepper, email, code),
    nowMs,
  });

  if (!outcome.ok) {
    switch (outcome.reason) {
      case 'invalid-code':
        throw authError('invalid-code', "That code isn't right.", {
          attemptsLeft: outcome.attemptsLeft,
        });
      case 'too-many-attempts':
        throw authError('too-many-attempts', 'Too many wrong codes. Request a new one.');
      case 'code-expired':
        throw authError('code-expired', 'This code has expired. Request a new one.');
    }
  }

  const user = await findOrCreateUserByEmail(deps.idt, email);
  return { token: await createCustomToken(deps.serviceAccount, user.uid, nowMs) };
}

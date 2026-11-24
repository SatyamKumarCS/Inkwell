import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import {
  Collections,
  EmailCodePolicy,
  emailCodeRecordSchema,
  timestampToMillis,
  verifyEmailCodeRequestSchema,
  type VerifyEmailCodeResponse,
} from '@inkwell/shared';

import { codesMatch, emailKey, hashCode } from './codes';
import { authError } from './errors';
import { findOrCreateUserByEmail } from './users';

export interface VerifyEmailCodeDeps {
  db: Firestore;
  auth: Auth;
  pepper: string;
  now?: () => Date;
}

type Outcome =
  | { ok: true }
  | { ok: false; reason: 'code-expired' | 'too-many-attempts' }
  | { ok: false; reason: 'invalid-code'; attemptsLeft: number };

/**
 * Checks a code and returns a Firebase custom token for the account that owns the email. Outcomes are
 * decided inside the transaction but thrown after it commits, so failed attempts are always recorded.
 */
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
  const now = (deps.now ?? (() => new Date()))().getTime();
  const codeRef = deps.db.collection(Collections.emailCodes).doc(emailKey(email));

  const outcome = await deps.db.runTransaction<Outcome>(async (tx) => {
    const snap = await tx.get(codeRef);
    const parsed = emailCodeRecordSchema.safeParse(snap.data());
    const record = parsed.success ? parsed.data : undefined;

    if (!record || record.codeHash === null) return { ok: false, reason: 'code-expired' };

    if (now >= timestampToMillis(record.expiresAt)) {
      tx.update(codeRef, { codeHash: null });
      return { ok: false, reason: 'code-expired' };
    }

    if (!codesMatch(record.codeHash, hashCode(deps.pepper, email, code))) {
      const attempts = record.attempts + 1;
      const attemptsLeft = EmailCodePolicy.maxAttempts - attempts;
      if (attemptsLeft <= 0) {
        tx.update(codeRef, { attempts, codeHash: null });
        return { ok: false, reason: 'too-many-attempts' };
      }
      tx.update(codeRef, { attempts });
      return { ok: false, reason: 'invalid-code', attemptsLeft };
    }

    // Single use.
    tx.update(codeRef, { codeHash: null });
    return { ok: true };
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

  const user = await findOrCreateUserByEmail(deps.auth, email);
  return { token: await deps.auth.createCustomToken(user.uid) };
}

import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import type { AuthErrorDetails, AuthErrorReason } from '@inkwell/shared';

const httpsCode: Record<AuthErrorReason, FunctionsErrorCode> = {
  'invalid-email': 'invalid-argument',
  'invalid-code': 'invalid-argument',
  'code-expired': 'failed-precondition',
  'too-many-attempts': 'resource-exhausted',
  'rate-limited': 'resource-exhausted',
  'daily-limit': 'resource-exhausted',
  // Not "unavailable": the app treats that code as "you're offline".
  'send-failed': 'internal',
};

/** An HttpsError whose `details.reason` tells the app which message to show. */
export function authError(
  reason: AuthErrorReason,
  message: string,
  extra: Omit<AuthErrorDetails, 'reason'> = {},
): HttpsError {
  const details: AuthErrorDetails = { reason, ...extra };
  return new HttpsError(httpsCode[reason], message, details);
}

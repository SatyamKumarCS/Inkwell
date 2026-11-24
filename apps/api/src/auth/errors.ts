import type { AuthErrorDetails, AuthErrorReason } from '@inkwell/shared';

import { ApiError, type ApiErrorCode } from '../http';

const errorCode: Record<AuthErrorReason, ApiErrorCode> = {
  'invalid-email': 'invalid-argument',
  'invalid-code': 'invalid-argument',
  'code-expired': 'failed-precondition',
  'too-many-attempts': 'resource-exhausted',
  'rate-limited': 'resource-exhausted',
  'daily-limit': 'resource-exhausted',
  // Not "unavailable": the app treats that code as "you're offline".
  'send-failed': 'internal',
  'invalid-google-token': 'unauthenticated',
  'email-not-verified': 'permission-denied',
};

/** An ApiError whose `details.reason` tells the app which message to show. */
export function authError(
  reason: AuthErrorReason,
  message: string,
  extra: Omit<AuthErrorDetails, 'reason'> = {},
): ApiError {
  const details: AuthErrorDetails = { reason, ...extra };
  return new ApiError(errorCode[reason], message, details);
}

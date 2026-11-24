import { authErrorDetailsSchema, type AuthErrorDetails } from '@inkwell/shared';

export type AuthFailure =
  | AuthErrorDetails
  | { reason: 'offline' | 'unknown'; attemptsLeft?: undefined; retryAfterSeconds?: undefined };

/** Turns anything thrown by an auth call into a reason the UI can explain. */
export function toAuthFailure(error: unknown): AuthFailure {
  const { code, details } = (error ?? {}) as { code?: unknown; details?: unknown };
  const parsed = authErrorDetailsSchema.safeParse(details);
  if (parsed.success) return parsed.data;

  const errorCode = typeof code === 'string' ? code : '';
  if (
    errorCode.endsWith('unavailable') ||
    errorCode.endsWith('deadline-exceeded') ||
    errorCode.endsWith('network-request-failed')
  ) {
    return { reason: 'offline' };
  }
  return { reason: 'unknown' };
}

function formatWait(seconds = 60): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function authFailureMessage(failure: AuthFailure): string {
  switch (failure.reason) {
    case 'invalid-email':
      return 'Enter a valid email address.';
    case 'invalid-code': {
      const left = failure.attemptsLeft;
      if (left === undefined) return "That code isn't right.";
      return `That code isn't right. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`;
    }
    case 'code-expired':
      return 'This code has expired. Send a new one.';
    case 'too-many-attempts':
      return 'Too many wrong codes. Send a new one.';
    case 'rate-limited':
      return `Too many requests. Try again in ${formatWait(failure.retryAfterSeconds)}.`;
    case 'daily-limit':
      return "We can't send sign-in codes right now. Please try again later.";
    case 'send-failed':
      return "We couldn't send the email. Please try again.";
    case 'invalid-google-token':
      return "Google sign-in didn't work. Please try again.";
    case 'email-not-verified':
      return 'Your Google account email is not verified. Verify it with Google, or sign in with an email code.';
    case 'offline':
      return "You're offline. Connect to the internet and try again.";
    case 'unknown':
      return 'Something went wrong. Please try again.';
  }
}

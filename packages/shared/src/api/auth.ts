import { z } from 'zod';
import { NAME_MAX_LENGTH } from '../models/user';

/** Request/response contracts for the auth callables, shared by the app and Cloud Functions. */

export const EMAIL_CODE_LENGTH = 6;

/** Fixed rules for email codes. Server-side caps (per-IP, global daily) are Functions params instead. */
export const EmailCodePolicy = {
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  maxSendsPerHour: 5,
} as const;

export const emailAddressSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const verificationCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${EMAIL_CODE_LENGTH}}$`), 'Expected a 6-digit code');

export const requestEmailCodeRequestSchema = z.object({ email: emailAddressSchema });
export type RequestEmailCodeRequest = z.input<typeof requestEmailCodeRequestSchema>;

export const requestEmailCodeResponseSchema = z.object({
  resendAfterSeconds: z.number().int().nonnegative(),
});
export type RequestEmailCodeResponse = z.infer<typeof requestEmailCodeResponseSchema>;

export const verifyEmailCodeRequestSchema = z.object({
  email: emailAddressSchema,
  code: verificationCodeSchema,
});
export type VerifyEmailCodeRequest = z.input<typeof verifyEmailCodeRequestSchema>;

export const verifyEmailCodeResponseSchema = z.object({ token: z.string().min(1) });
export type VerifyEmailCodeResponse = z.infer<typeof verifyEmailCodeResponseSchema>;

export const completeProfileRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  lastName: z.string().trim().max(NAME_MAX_LENGTH).default(''),
});
export type CompleteProfileRequest = z.input<typeof completeProfileRequestSchema>;

export const completeProfileResponseSchema = z.object({ spaceId: z.string().min(1) });
export type CompleteProfileResponse = z.infer<typeof completeProfileResponseSchema>;

/** Why an auth callable failed. Sent in `HttpsError.details.reason`. */
export const authErrorReasonSchema = z.enum([
  'invalid-email',
  'invalid-code',
  'code-expired',
  'too-many-attempts',
  'rate-limited',
  'daily-limit',
  'send-failed',
]);
export type AuthErrorReason = z.infer<typeof authErrorReasonSchema>;

/** `HttpsError.details` payload. Numbers are coerced because native bridges may stringify them. */
export const authErrorDetailsSchema = z.object({
  reason: authErrorReasonSchema,
  attemptsLeft: z.coerce.number().int().optional(),
  retryAfterSeconds: z.coerce.number().int().optional(),
});
export type AuthErrorDetails = z.infer<typeof authErrorDetailsSchema>;

export const Callables = {
  requestEmailCode: 'requestEmailCode',
  verifyEmailCode: 'verifyEmailCode',
  completeProfile: 'completeProfile',
} as const;

/** Cloud Functions region (Mumbai — most users are in India). Firestore lives in the same region. */
export const FUNCTIONS_REGION = 'asia-south1';

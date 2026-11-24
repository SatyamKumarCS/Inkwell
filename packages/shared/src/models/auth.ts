import { z } from 'zod';
import { timestampSchema } from '../timestamp';

/**
 * Server-only documents used by email-code sign-in. Security rules deny all client access; only Cloud
 * Functions (Admin SDK) read and write them.
 */

/** A fixed-window counter: `count` requests since `windowStart`. */
export const rateWindowSchema = z.object({
  windowStart: timestampSchema,
  count: z.number().int().nonnegative(),
});
export type RateWindow = z.infer<typeof rateWindowSchema>;

/** `emailCodes/{sha256(email)}` — the active code for an email plus its send-rate window. */
export const emailCodeRecordSchema = z.object({
  /** HMAC-SHA256 of the code; null once the code is used, expired or locked. */
  codeHash: z.string().nullable(),
  expiresAt: timestampSchema,
  attempts: z.number().int().nonnegative(),
  lastSentAt: timestampSchema,
  sends: rateWindowSchema,
  /** Firestore TTL policy field: the doc may be deleted after this. */
  purgeAt: timestampSchema,
});
export type EmailCodeRecord = z.infer<typeof emailCodeRecordSchema>;

/** `rateLimits/{key}` — per-IP and global daily counters for code sends. */
export const rateLimitSchema = rateWindowSchema.extend({
  /** Firestore TTL policy field: the doc may be deleted after this. */
  purgeAt: timestampSchema,
});
export type RateLimit = z.infer<typeof rateLimitSchema>;

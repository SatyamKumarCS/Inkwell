/**
 * Secrets (`wrangler secret put` in production, `.dev.vars` locally) and dev-only emulator settings. They are
 * not in wrangler.jsonc, so they are missing from the generated `Env` type and declared here instead.
 */
export interface Secrets {
  OTP_PEPPER: string;
  RESEND_API_KEY: string;
  /** The service-account JSON key, as a string. */
  GOOGLE_SERVICE_ACCOUNT: string;
  /** Local development and tests only. */
  FIRESTORE_EMULATOR_HOST?: string;
  FIREBASE_AUTH_EMULATOR_HOST?: string;
}

export type AppEnv = Env & Secrets;

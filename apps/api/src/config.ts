import { z } from 'zod';

import type { AppEnv } from './env';

const serviceAccountSchema = z.object({
  client_email: z.email(),
  private_key: z.string().includes('PRIVATE KEY'),
  private_key_id: z.string().min(1),
  token_uri: z.url().default('https://oauth2.googleapis.com/token'),
});
export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

const envSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is not set'),
  GOOGLE_WEB_CLIENT_ID: z.string().default(''),
  EMAIL_FROM: z.string().min(1),
  EMAIL_CODE_TTL_SECONDS: z.coerce.number().int().positive(),
  AUTH_IP_HOURLY_LIMIT: z.coerce.number().int().positive(),
  EMAIL_CODE_DAILY_CAP: z.coerce.number().int().positive(),
  OTP_PEPPER: z.string().min(8, 'OTP_PEPPER secret is not set'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY secret is not set'),
  GOOGLE_SERVICE_ACCOUNT: z.string().min(1, 'GOOGLE_SERVICE_ACCOUNT secret is not set'),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
});

export interface Config {
  projectId: string;
  /** Emulator hosts (`host:port`) in local dev and tests; null in production. */
  emulators: { firestore: string; auth: string } | null;
  googleWebClientId: string;
  emailFrom: string;
  pepper: string;
  resendApiKey: string;
  serviceAccount: ServiceAccount;
  limits: { ttlSeconds: number; ipPerHour: number; dailyCap: number };
}

/**
 * Validates the Worker's environment. Emulators are only ever paired with a `demo-*` project (which can't
 * exist in production) and production only with a real project, mirroring the app's guard.
 */
export function loadConfig(env: AppEnv): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Invalid API configuration: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    );
  }
  const e = parsed.data;

  const firestoreHost = e.FIRESTORE_EMULATOR_HOST || '';
  const authHost = e.FIREBASE_AUTH_EMULATOR_HOST || '';
  if (Boolean(firestoreHost) !== Boolean(authHost)) {
    throw new Error(
      'Set both FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST, or neither.',
    );
  }
  const emulators = firestoreHost ? { firestore: firestoreHost, auth: authHost } : null;
  const isDemoProject = e.FIREBASE_PROJECT_ID.startsWith('demo-');
  if (emulators && !isDemoProject) {
    throw new Error(`Emulators are configured but the project "${e.FIREBASE_PROJECT_ID}" is real.`);
  }
  if (!emulators && isDemoProject) {
    throw new Error(
      `"${e.FIREBASE_PROJECT_ID}" is a demo project; it only works with the emulators.`,
    );
  }

  let serviceAccountJson: unknown;
  try {
    serviceAccountJson = JSON.parse(e.GOOGLE_SERVICE_ACCOUNT);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT is not valid JSON.');
  }
  const serviceAccount = serviceAccountSchema.safeParse(serviceAccountJson);
  if (!serviceAccount.success) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT is not a service-account key.');
  }

  return {
    projectId: e.FIREBASE_PROJECT_ID,
    emulators,
    googleWebClientId: e.GOOGLE_WEB_CLIENT_ID,
    emailFrom: e.EMAIL_FROM,
    pepper: e.OTP_PEPPER,
    resendApiKey: e.RESEND_API_KEY,
    serviceAccount: serviceAccount.data,
    limits: {
      ttlSeconds: e.EMAIL_CODE_TTL_SECONDS,
      ipPerHour: e.AUTH_IP_HOURLY_LIMIT,
      dailyCap: e.EMAIL_CODE_DAILY_CAP,
    },
  };
}

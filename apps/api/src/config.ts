import type { AppEnv } from './env';

// Validated with plain checks rather than zod: config is read on cold requests, and a zod schema's first
// parse in a fresh isolate costs ~1 ms of the 10 ms Workers Free CPU budget each (measured).

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  private_key_id: string;
  token_uri: string;
}

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

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

const isString = (value: unknown): value is string => typeof value === 'string';

/** A positive integer from a number or numeric string (wrangler vars may arrive as either). */
function positiveInt(value: unknown, name: string, issues: string[]): number {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number === 'number' && Number.isInteger(number) && number > 0) return number;
  issues.push(`${name} must be a positive integer`);
  return 0;
}

function requiredString(value: unknown, minLength: number, message: string, issues: string[]) {
  if (isString(value) && value.length >= minLength) return value;
  issues.push(message);
  return '';
}

function parseServiceAccount(json: string): ServiceAccount {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT is not valid JSON.');
  }
  const sa = (value ?? {}) as Record<string, unknown>;
  const tokenUri = sa.token_uri ?? DEFAULT_TOKEN_URI;
  const valid =
    typeof value === 'object' &&
    isString(sa.client_email) &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sa.client_email) &&
    isString(sa.private_key) &&
    sa.private_key.includes('PRIVATE KEY') &&
    isString(sa.private_key_id) &&
    sa.private_key_id.length > 0 &&
    isString(tokenUri) &&
    URL.canParse(tokenUri);
  if (!valid) throw new Error('GOOGLE_SERVICE_ACCOUNT is not a service-account key.');
  return {
    client_email: sa.client_email as string,
    private_key: sa.private_key as string,
    private_key_id: sa.private_key_id as string,
    token_uri: tokenUri as string,
  };
}

/** The env object is fixed for an isolate's lifetime, so each one is validated once. */
const cache = new WeakMap<AppEnv, Config>();

/**
 * Validates the Worker's environment. Emulators are only ever paired with a `demo-*` project (which can't
 * exist in production) and production only with a real project, mirroring the app's guard.
 */
export function loadConfig(env: AppEnv): Config {
  const cached = cache.get(env);
  if (cached) return cached;

  const e = env as unknown as Record<string, unknown>;
  const issues: string[] = [];
  const projectId = requiredString(e.FIREBASE_PROJECT_ID, 1, 'FIREBASE_PROJECT_ID is not set', issues);
  const googleWebClientId = isString(e.GOOGLE_WEB_CLIENT_ID) ? e.GOOGLE_WEB_CLIENT_ID : '';
  const emailFrom = requiredString(e.EMAIL_FROM, 1, 'EMAIL_FROM is not set', issues);
  const ttlSeconds = positiveInt(e.EMAIL_CODE_TTL_SECONDS, 'EMAIL_CODE_TTL_SECONDS', issues);
  const ipPerHour = positiveInt(e.AUTH_IP_HOURLY_LIMIT, 'AUTH_IP_HOURLY_LIMIT', issues);
  const dailyCap = positiveInt(e.EMAIL_CODE_DAILY_CAP, 'EMAIL_CODE_DAILY_CAP', issues);
  const pepper = requiredString(e.OTP_PEPPER, 8, 'OTP_PEPPER secret is not set', issues);
  const resendApiKey = requiredString(e.RESEND_API_KEY, 1, 'RESEND_API_KEY secret is not set', issues);
  const serviceAccountJson = requiredString(
    e.GOOGLE_SERVICE_ACCOUNT,
    1,
    'GOOGLE_SERVICE_ACCOUNT secret is not set',
    issues,
  );
  if (issues.length > 0) throw new Error(`Invalid API configuration: ${issues.join('; ')}`);

  const firestoreHost = isString(e.FIRESTORE_EMULATOR_HOST) ? e.FIRESTORE_EMULATOR_HOST : '';
  const authHost = isString(e.FIREBASE_AUTH_EMULATOR_HOST) ? e.FIREBASE_AUTH_EMULATOR_HOST : '';
  if (Boolean(firestoreHost) !== Boolean(authHost)) {
    throw new Error(
      'Set both FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST, or neither.',
    );
  }
  const emulators = firestoreHost ? { firestore: firestoreHost, auth: authHost } : null;
  const isDemoProject = projectId.startsWith('demo-');
  if (emulators && !isDemoProject) {
    throw new Error(`Emulators are configured but the project "${projectId}" is real.`);
  }
  if (!emulators && isDemoProject) {
    throw new Error(`"${projectId}" is a demo project; it only works with the emulators.`);
  }

  const config: Config = {
    projectId,
    emulators,
    googleWebClientId,
    emailFrom,
    pepper,
    resendApiKey,
    serviceAccount: parseServiceAccount(serviceAccountJson),
    limits: { ttlSeconds, ipPerHour, dailyCap },
  };
  cache.set(env, config);
  return config;
}

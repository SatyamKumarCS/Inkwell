import { Callables } from '@inkwell/shared';

import { AuthGuard } from './auth/authGuard';
import { callerIpKey } from './auth/codes';
import { completeProfile } from './auth/completeProfile';
import { requestEmailCode, verifyEmailCode } from './auth/emailCode';
import { signInWithGoogle } from './auth/google';
import type { Guard } from './auth/guard';
import { sendCodeEmail } from './auth/mailer';
import { verifyFirebaseIdToken, verifyGoogleIdTokenSignature } from './auth/tokens';
import { loadConfig, type Config } from './config';
import type { AppEnv } from './env';
import { getAccessToken } from './google/accessToken';
import { Firestore } from './google/firestore';
import { IdentityToolkit } from './google/identityToolkit';
import { FIREBASE_ID_TOKEN_JWKS, GOOGLE_ID_TOKEN_JWKS, jwksKeySource } from './google/jwks';
import type { AuthHeader } from './google/rest';
import { ApiError, bearerToken, errorResponse, readCallableData, resultResponse } from './http';

export { AuthGuard };

/** The single global AuthGuard, placed near most users (India). Tests pass their own instance name. */
export function guardFor(env: AppEnv, name = 'global'): Guard {
  return env.AUTH_GUARD.get(env.AUTH_GUARD.idFromName(name), { locationHint: 'apac' });
}

const firebaseKeys = jwksKeySource(FIREBASE_ID_TOKEN_JWKS);
const googleKeys = jwksKeySource(GOOGLE_ID_TOKEN_JWKS);

function clients(config: Config, guard: Guard) {
  // The emulators accept their admin token; production uses the service account's OAuth token.
  const authHeader: AuthHeader = config.emulators
    ? () => Promise.resolve('Bearer owner')
    : async () => `Bearer ${await getAccessToken(config.serviceAccount, guard)}`;
  return {
    idt: new IdentityToolkit(config.projectId, authHeader, config.emulators?.auth),
    db: new Firestore(config.projectId, authHeader, config.emulators?.firestore),
  };
}

type Handler = (data: unknown, request: Request, config: Config, guard: Guard) => Promise<unknown>;

const handlers: Record<string, Handler> = {
  [`/${Callables.requestEmailCode}`]: (data, request, config, guard) =>
    requestEmailCode(data, {
      guard,
      pepper: config.pepper,
      limits: config.limits,
      ipKey: callerIpKey(request.headers),
      sendCode: (to, code) =>
        sendCodeEmail(
          { to, code, ttlMinutes: Math.round(config.limits.ttlSeconds / 60) },
          {
            apiKey: config.resendApiKey,
            from: config.emailFrom,
            logOnly: config.emulators !== null,
          },
        ),
    }),

  [`/${Callables.verifyEmailCode}`]: (data, _request, config, guard) =>
    verifyEmailCode(data, {
      guard,
      idt: clients(config, guard).idt,
      pepper: config.pepper,
      serviceAccount: config.serviceAccount,
    }),

  [`/${Callables.completeProfile}`]: async (data, request, config, guard) => {
    const caller = await verifyFirebaseIdToken(bearerToken(request), {
      projectId: config.projectId,
      emulator: config.emulators !== null,
      keys: firebaseKeys,
    });
    return completeProfile(data, caller, clients(config, guard).db);
  },

  [`/${Callables.signInWithGoogle}`]: (data, request, config, guard) =>
    signInWithGoogle(data, {
      guard,
      idt: clients(config, guard).idt,
      serviceAccount: config.serviceAccount,
      audience: config.googleWebClientId,
      ipKey: callerIpKey(request.headers),
      ipPerHour: config.limits.ipPerHour,
      verify: (idToken) => verifyGoogleIdTokenSignature(idToken, googleKeys),
    }),
};

export async function handleRequest(
  request: Request,
  env: AppEnv,
  guard: Guard,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === '/health') return Response.json({ ok: true });

  const handler = handlers[pathname];
  try {
    if (!handler) throw new ApiError('not-found', 'Not found.');
    const config = loadConfig(env);
    const data = await readCallableData(request);
    return resultResponse(await handler(data, request, config, guard));
  } catch (error) {
    return errorResponse(error);
  }
}

export default {
  fetch: (request, env) => handleRequest(request, env, guardFor(env)),
} satisfies ExportedHandler<AppEnv>;

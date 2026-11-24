import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adminAuth, db } from '../admin';
import {
  EMAIL_CODE_DAILY_CAP,
  EMAIL_CODE_IP_HOURLY_LIMIT,
  EMAIL_CODE_TTL_SECONDS,
  EMAIL_FROM,
  OTP_PEPPER,
  RESEND_API_KEY,
} from '../config';
import { clientIp, ipBucket } from './codes';
import { completeProfile } from './completeProfile';
import { sendCodeEmail } from './mailer';
import { requestEmailCode } from './requestEmailCode';
import { verifyEmailCode } from './verifyEmailCode';

// App Check enforcement on these callables is a Phase 7 item (see SPEC.md).

export const requestEmailCodeFn = onCall({ secrets: [OTP_PEPPER, RESEND_API_KEY] }, (request) => {
  const ip = clientIp(request.rawRequest.headers, request.rawRequest.ip);
  const ttlSeconds = EMAIL_CODE_TTL_SECONDS.value();
  return requestEmailCode(request.data, {
    db: db(),
    pepper: OTP_PEPPER.value(),
    ipKey: ip ? ipBucket(ip) : null,
    limits: {
      ttlSeconds,
      ipPerHour: EMAIL_CODE_IP_HOURLY_LIMIT.value(),
      dailyCap: EMAIL_CODE_DAILY_CAP.value(),
    },
    sendCode: (to, code) =>
      sendCodeEmail(
        { to, code, ttlMinutes: Math.round(ttlSeconds / 60) },
        { apiKey: RESEND_API_KEY.value(), from: EMAIL_FROM.value() },
      ),
  });
});

export const verifyEmailCodeFn = onCall({ secrets: [OTP_PEPPER] }, (request) =>
  verifyEmailCode(request.data, { db: db(), auth: adminAuth(), pepper: OTP_PEPPER.value() }),
);

export const completeProfileFn = onCall((request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { uid, token } = request.auth;
  return completeProfile(
    request.data,
    {
      uid,
      email: typeof token.email === 'string' ? token.email : null,
      photoURL: typeof token.picture === 'string' ? token.picture : null,
    },
    db(),
  );
});

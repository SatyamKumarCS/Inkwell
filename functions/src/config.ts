import { defineInt, defineSecret, defineString } from 'firebase-functions/params';

// Secrets live in Secret Manager (`firebase functions:secrets:set`); the emulator reads functions/.secret.local.
export const OTP_PEPPER = defineSecret('OTP_PEPPER');
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// Non-secret params; values in functions/.env (committed), overridable per machine in functions/.env.local.
export const EMAIL_FROM = defineString('EMAIL_FROM', {
  default: 'Inkwell <onboarding@resend.dev>',
  description: 'Sender for sign-in code emails. Must be on a domain verified in Resend.',
});
export const EMAIL_CODE_TTL_SECONDS = defineInt('EMAIL_CODE_TTL_SECONDS', {
  default: 600,
  description: 'How long a sign-in code stays valid.',
});
export const AUTH_IP_HOURLY_LIMIT = defineInt('AUTH_IP_HOURLY_LIMIT', {
  default: 10,
  description:
    'Per IP (IPv6: per /64) and hour: max sign-in code emails, and separately max Google sign-ins.',
});
export const EMAIL_CODE_DAILY_CAP = defineInt('EMAIL_CODE_DAILY_CAP', {
  default: 200,
  description: 'Max sign-in code emails per UTC day for the whole project.',
});
export const GOOGLE_WEB_CLIENT_ID = defineString('GOOGLE_WEB_CLIENT_ID', {
  default: '',
  description:
    'Web client ID from Firebase (Authentication > Google > Web SDK configuration). Audience of the ' +
    "app's Google ID tokens. Empty disables Google sign-in.",
});

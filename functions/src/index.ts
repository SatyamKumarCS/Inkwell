import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';

// Functions are built in later phases: auth OTP (1), notifications (3), AI (4), publishing (5).
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

/** Lets local dev confirm the Functions emulator is running. Returns no data. */
export const healthcheck = onRequest((_req, res) => {
  res.json({ ok: true });
});

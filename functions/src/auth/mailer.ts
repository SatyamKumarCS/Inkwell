import { logger } from 'firebase-functions/logger';

export interface CodeEmail {
  to: string;
  code: string;
  ttlMinutes: number;
}

export interface MailerConfig {
  apiKey: string;
  from: string;
}

export const isEmulator = () => process.env.FUNCTIONS_EMULATOR === 'true';

/** Sends the sign-in code with Resend. In the Functions emulator the code is only logged. */
export async function sendCodeEmail({ to, code, ttlMinutes }: CodeEmail, config: MailerConfig) {
  if (isEmulator()) {
    logger.info(`[emulator] Sign-in code for ${to}: ${code}`);
    return;
  }

  const text = [
    `Your Inkwell sign-in code is ${code}.`,
    `It expires in ${ttlMinutes} minutes. If you didn't ask for it, you can ignore this email.`,
  ].join('\n\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject: `${code} is your Inkwell sign-in code`,
      text,
      html: `<p>Your Inkwell sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in ${ttlMinutes} minutes. If you didn't ask for it, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  }
}

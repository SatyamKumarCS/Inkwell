import type { TokenStore } from '../google/accessToken';
import type {
  ConsumeIpInput,
  RecordSendInput,
  SendOutcome,
  VerifyInput,
  VerifyOutcome,
} from './authGuard';

/** The AuthGuard Durable Object as callers see it (RPC methods return promises). */
export interface Guard extends TokenStore {
  recordSend(input: RecordSendInput): Promise<SendOutcome>;
  cancelSend(emailKey: string): Promise<void>;
  verify(input: VerifyInput): Promise<VerifyOutcome>;
  consumeIp(input: ConsumeIpInput): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export function warnUnknownIp(action: string) {
  console.warn(
    `${action}: caller IP could not be determined reliably; skipping the per-IP limit ` +
      '(global limits still apply)',
  );
}

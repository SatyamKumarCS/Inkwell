import { DurableObject } from 'cloudflare:workers';
import { EmailCodePolicy } from '@inkwell/shared';

import { timingSafeEqualHex } from '../crypto/hash';
import type { AppEnv } from '../env';
import { checkWindow, type Window } from './rateWindow';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type SendOutcome =
  { ok: true } | { ok: false; reason: 'rate-limited' | 'daily-limit'; retryAfterSeconds: number };

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: 'code-expired' | 'too-many-attempts' }
  | { ok: false; reason: 'invalid-code'; attemptsLeft: number };

export interface RecordSendInput {
  emailKey: string;
  codeHash: string;
  /** Hashed IP bucket, or null when the caller's IP is unknown (per-IP limit skipped). */
  ipHash: string | null;
  nowMs: number;
  ttlSeconds: number;
  ipPerHour: number;
  dailyCap: number;
}

export interface VerifyInput {
  emailKey: string;
  candidateHash: string;
  nowMs: number;
}

export interface ConsumeIpInput {
  scope: 'google';
  ipHash: string;
  nowMs: number;
  perHour: number;
}

interface EmailCodeRow extends Record<string, SqlStorageValue> {
  code_hash: string | null;
  expires_at: number;
  attempts: number;
  last_sent_at: number;
  window_start: number;
  window_count: number;
}

interface WindowRow extends Record<string, SqlStorageValue> {
  window_start: number;
  count: number;
}

/**
 * Email codes, sign-in rate limits and the Google OAuth token cache. One global instance: every method runs
 * synchronously against the object's private SQLite database, so each check-and-write is atomic. Replaces
 * the Firestore `emailCodes`/`rateLimits` collections, which cost quota and need TTL (unavailable on Spark).
 */
export class AuthGuard extends DurableObject<AppEnv> {
  private readonly sql = this.ctx.storage.sql;

  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS email_codes (
        email_key TEXT PRIMARY KEY,
        code_hash TEXT,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL,
        last_sent_at INTEGER NOT NULL,
        window_start INTEGER NOT NULL,
        window_count INTEGER NOT NULL,
        purge_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ip_windows (
        key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL,
        purge_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daily_sends (day TEXT PRIMARY KEY, count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS tokens (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NOT NULL);
    `);
  }

  /** Expired rows are deleted as we go (Firestore TTL isn't available on Spark; here it's free anyway). */
  private purge(nowMs: number) {
    this.sql.exec('DELETE FROM email_codes WHERE purge_at < ?', nowMs);
    this.sql.exec('DELETE FROM ip_windows WHERE purge_at < ?', nowMs);
    this.sql.exec('DELETE FROM daily_sends WHERE day < ?', utcDay(nowMs - DAY_MS));
    this.sql.exec('DELETE FROM tokens WHERE expires_at < ?', nowMs);
  }

  private ipWindow(key: string): Window | undefined {
    const row = this.sql
      .exec<WindowRow>('SELECT window_start, count FROM ip_windows WHERE key = ?', key)
      .toArray()[0];
    return row && { windowStartMs: row.window_start, count: row.count };
  }

  private saveIpWindow(key: string, next: Window) {
    this.sql.exec(
      'INSERT OR REPLACE INTO ip_windows (key, window_start, count, purge_at) VALUES (?, ?, ?, ?)',
      key,
      next.windowStartMs,
      next.count,
      next.windowStartMs + HOUR_MS,
    );
  }

  /**
   * Checks every limit for a new code (resend cooldown, per-email hourly, per-IP hourly, global daily) and,
   * if all pass, stores the code hash. Nothing is written when a limit blocks the send.
   */
  recordSend(input: RecordSendInput): SendOutcome {
    const { nowMs } = input;
    this.purge(nowMs);

    const record = this.sql
      .exec<EmailCodeRow>('SELECT * FROM email_codes WHERE email_key = ?', input.emailKey)
      .toArray()[0];
    if (record) {
      const cooldownEndsMs = record.last_sent_at + EmailCodePolicy.resendCooldownSeconds * 1000;
      if (nowMs < cooldownEndsMs) {
        return {
          ok: false,
          reason: 'rate-limited',
          retryAfterSeconds: Math.ceil((cooldownEndsMs - nowMs) / 1000),
        };
      }
    }

    const emailWindow = checkWindow(
      record && { windowStartMs: record.window_start, count: record.window_count },
      nowMs,
      HOUR_MS,
      EmailCodePolicy.maxSendsPerHour,
    );
    if (!emailWindow.allowed) {
      return {
        ok: false,
        reason: 'rate-limited',
        retryAfterSeconds: emailWindow.retryAfterSeconds,
      };
    }

    const ipKey = input.ipHash ? `email:${input.ipHash}` : null;
    const ipCheck = ipKey
      ? checkWindow(this.ipWindow(ipKey), nowMs, HOUR_MS, input.ipPerHour)
      : null;
    if (ipCheck && !ipCheck.allowed) {
      return { ok: false, reason: 'rate-limited', retryAfterSeconds: ipCheck.retryAfterSeconds };
    }

    const day = utcDay(nowMs);
    const sentToday =
      this.sql
        .exec<{ count: number }>('SELECT count FROM daily_sends WHERE day = ?', day)
        .toArray()[0]?.count ?? 0;
    if (sentToday >= input.dailyCap) {
      const nextDayMs = Date.parse(`${day}T00:00:00.000Z`) + DAY_MS;
      return {
        ok: false,
        reason: 'daily-limit',
        retryAfterSeconds: Math.ceil((nextDayMs - nowMs) / 1000),
      };
    }

    const expiresAtMs = nowMs + input.ttlSeconds * 1000;
    this.sql.exec(
      `INSERT OR REPLACE INTO email_codes
         (email_key, code_hash, expires_at, attempts, last_sent_at, window_start, window_count, purge_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
      input.emailKey,
      input.codeHash,
      expiresAtMs,
      nowMs,
      emailWindow.next.windowStartMs,
      emailWindow.next.count,
      Math.max(expiresAtMs, emailWindow.next.windowStartMs + HOUR_MS),
    );
    if (ipKey && ipCheck) this.saveIpWindow(ipKey, ipCheck.next);
    this.sql.exec(
      'INSERT INTO daily_sends (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1',
      day,
    );
    return { ok: true };
  }

  /** The email couldn't be sent: drop the code and lift the cooldown so the user can retry straight away. */
  cancelSend(emailKey: string): void {
    this.sql.exec(
      'UPDATE email_codes SET code_hash = NULL, last_sent_at = 0 WHERE email_key = ?',
      emailKey,
    );
  }

  /** Checks a code. Wrong guesses are counted; the code is single use and locks after too many attempts. */
  verify(input: VerifyInput): VerifyOutcome {
    const record = this.sql
      .exec<EmailCodeRow>('SELECT * FROM email_codes WHERE email_key = ?', input.emailKey)
      .toArray()[0];
    if (!record || record.code_hash === null) return { ok: false, reason: 'code-expired' };

    const clearCode = () =>
      this.sql.exec('UPDATE email_codes SET code_hash = NULL WHERE email_key = ?', input.emailKey);

    if (input.nowMs >= record.expires_at) {
      clearCode();
      return { ok: false, reason: 'code-expired' };
    }

    if (!timingSafeEqualHex(record.code_hash, input.candidateHash)) {
      const attempts = record.attempts + 1;
      const attemptsLeft = EmailCodePolicy.maxAttempts - attempts;
      this.sql.exec(
        'UPDATE email_codes SET attempts = ? WHERE email_key = ?',
        attempts,
        input.emailKey,
      );
      if (attemptsLeft <= 0) {
        clearCode();
        return { ok: false, reason: 'too-many-attempts' };
      }
      return { ok: false, reason: 'invalid-code', attemptsLeft };
    }

    clearCode();
    return { ok: true };
  }

  /** Counts one request against an IP bucket (e.g. Google sign-ins); separate from the email-code counter. */
  consumeIp(input: ConsumeIpInput): { allowed: boolean; retryAfterSeconds: number } {
    this.purge(input.nowMs);
    const key = `${input.scope}:${input.ipHash}`;
    const check = checkWindow(this.ipWindow(key), input.nowMs, HOUR_MS, input.perHour);
    if (check.allowed) this.saveIpWindow(key, check.next);
    return { allowed: check.allowed, retryAfterSeconds: check.retryAfterSeconds };
  }

  getToken(key: string, nowMs: number): string | null {
    const row = this.sql
      .exec<{ value: string; expires_at: number }>(
        'SELECT value, expires_at FROM tokens WHERE key = ?',
        key,
      )
      .toArray()[0];
    return row && row.expires_at > nowMs ? row.value : null;
  }

  putToken(key: string, token: string, expiresAtMs: number): void {
    this.sql.exec(
      'INSERT OR REPLACE INTO tokens (key, value, expires_at) VALUES (?, ?, ?)',
      key,
      token,
      expiresAtMs,
    );
  }
}

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

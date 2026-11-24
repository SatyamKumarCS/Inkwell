export interface Window {
  windowStartMs: number;
  count: number;
}

export interface WindowCheck {
  allowed: boolean;
  /** Seconds until the window resets (0 when allowed). */
  retryAfterSeconds: number;
  /** The window to store if the request goes ahead (count already incremented). */
  next: Window;
}

/** Fixed-window limiter: at most `limit` events per `windowMs`, starting from the first event. */
export function checkWindow(
  current: Window | undefined,
  nowMs: number,
  windowMs: number,
  limit: number,
): WindowCheck {
  const expired = !current || nowMs - current.windowStartMs >= windowMs;
  const windowStartMs = expired ? nowMs : current.windowStartMs;
  const count = expired ? 0 : current.count;

  if (count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((windowStartMs + windowMs - nowMs) / 1000),
      next: { windowStartMs, count },
    };
  }
  return { allowed: true, retryAfterSeconds: 0, next: { windowStartMs, count: count + 1 } };
}

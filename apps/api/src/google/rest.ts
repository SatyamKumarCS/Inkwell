/** A failed Google REST call. `status` is the canonical code (e.g. `ALREADY_EXISTS`), `reason` the message. */
export class GoogleApiError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly status: string,
    readonly reason: string,
  ) {
    super(`Google API error ${httpStatus} ${status}: ${reason}`);
    this.name = 'GoogleApiError';
  }
}

/** Returns the `Authorization` header value: the emulators' admin token, or an OAuth token. */
export type AuthHeader = () => Promise<string>;

export async function googleFetch<T>(
  url: string,
  authHeader: AuthHeader,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      authorization: await authHeader(),
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = (body as { error?: { status?: string; message?: string } }).error;
    throw new GoogleApiError(response.status, error?.status ?? '', error?.message ?? text);
  }
  return body as T;
}

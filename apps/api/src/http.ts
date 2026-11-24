/**
 * The Firebase callable wire format, kept so the app and shared contracts don't change: requests are
 * `POST {"data": …}`, responses `{"result": …}` or `{"error": {"status", "message", "details"}}`.
 */

export type ApiErrorCode =
  | 'invalid-argument'
  | 'failed-precondition'
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'resource-exhausted'
  | 'internal'
  | 'unavailable';

const httpStatus: Record<ApiErrorCode, number> = {
  'invalid-argument': 400,
  'failed-precondition': 400,
  unauthenticated: 401,
  'permission-denied': 403,
  'not-found': 404,
  'resource-exhausted': 429,
  internal: 500,
  unavailable: 503,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return json(
      {
        error: {
          status: error.code.toUpperCase().replace(/-/g, '_'),
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      httpStatus[error.code],
    );
  }
  // Never leak internals: log them, return a generic error.
  console.error('[api] unhandled error', error);
  return json({ error: { status: 'INTERNAL', message: 'Internal error' } }, 500);
}

/** Reads the `data` field of a callable request body. */
export async function readCallableData(request: Request): Promise<unknown> {
  if (request.method !== 'POST') throw new ApiError('invalid-argument', 'Use POST.');
  try {
    const body = (await request.json()) as { data?: unknown } | null;
    return body?.data ?? null;
  } catch {
    throw new ApiError('invalid-argument', 'Expected a JSON body.');
  }
}

export const resultResponse = (result: unknown) => json({ result });

/** The bearer token from the Authorization header, if any. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  const match = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
  return match?.[1]?.trim() || null;
}

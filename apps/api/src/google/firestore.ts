import { googleFetch, GoogleApiError, type AuthHeader } from './rest';

/** Placeholder for a field Firestore sets to the commit time (like `serverTimestamp()` in the SDKs). */
export const SERVER_TIMESTAMP = Symbol('serverTimestamp');

export type FirestoreInput =
  | null
  | boolean
  | number
  | string
  | Date
  | typeof SERVER_TIMESTAMP
  | FirestoreInput[]
  | { [key: string]: FirestoreInput };

type Value = Record<string, unknown>;

function encodeValue(value: FirestoreInput): Value {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } };
  throw new Error('Server timestamps are only allowed as top-level fields');
}

function encodeFields(data: { [key: string]: FirestoreInput }): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v !== SERVER_TIMESTAMP)
      .map(([k, v]) => [k, encodeValue(v)]),
  );
}

/** Firestore timestamps are returned in the structural `{ seconds, nanoseconds }` shape used in `@inkwell/shared`. */
function decodeTimestamp(text: string): { seconds: number; nanoseconds: number } {
  const match = /\.(\d+)Z$/.exec(text);
  const nanoseconds = match?.[1] ? Number(match[1].padEnd(9, '0').slice(0, 9)) : 0;
  return { seconds: Math.floor(Date.parse(text) / 1000), nanoseconds };
}

export function decodeValue(value: Value): unknown {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return decodeTimestamp(String(value.timestampValue));
  if ('arrayValue' in value) {
    const values = (value.arrayValue as { values?: Value[] }).values ?? [];
    return values.map(decodeValue);
  }
  if ('mapValue' in value)
    return decodeFields((value.mapValue as { fields?: Record<string, Value> }).fields);
  if ('referenceValue' in value) return value.referenceValue;
  throw new Error(`Unsupported Firestore value: ${Object.keys(value).join(',')}`);
}

function decodeFields(fields: Record<string, Value> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, decodeValue(v)]));
}

export interface Write {
  update: { name: string; fields: Record<string, Value> };
  currentDocument?: { exists: boolean };
  updateTransforms?: { fieldPath: string; setToServerValue: 'REQUEST_TIME' }[];
}

export class Firestore {
  private readonly root: string;
  private readonly documents: string;

  constructor(
    private readonly projectId: string,
    private readonly authHeader: AuthHeader,
    emulatorHost?: string,
  ) {
    this.root = emulatorHost ? `http://${emulatorHost}/v1` : 'https://firestore.googleapis.com/v1';
    this.documents = `projects/${projectId}/databases/(default)/documents`;
  }

  /** One read. Returns null if the document doesn't exist. */
  async get(path: string): Promise<Record<string, unknown> | null> {
    try {
      const doc = await googleFetch<{ fields?: Record<string, Value> }>(
        `${this.root}/${this.documents}/${path}`,
        this.authHeader,
      );
      return decodeFields(doc.fields);
    } catch (error) {
      if (error instanceof GoogleApiError && error.httpStatus === 404) return null;
      throw error;
    }
  }

  /** A write that only succeeds if the document doesn't exist yet. SERVER_TIMESTAMP fields get the commit time. */
  createWrite(path: string, data: { [key: string]: FirestoreInput }): Write {
    const timestamps = Object.entries(data)
      .filter(([, v]) => v === SERVER_TIMESTAMP)
      .map(([fieldPath]) => ({ fieldPath, setToServerValue: 'REQUEST_TIME' as const }));
    return {
      update: { name: `${this.documents}/${path}`, fields: encodeFields(data) },
      currentDocument: { exists: false },
      ...(timestamps.length ? { updateTransforms: timestamps } : {}),
    };
  }

  /** Applies the writes atomically (all or none); one write each against the quota. */
  async commit(writes: Write[]): Promise<void> {
    await googleFetch(`${this.root}/${this.documents}:commit`, this.authHeader, {
      body: { writes },
    });
  }

  /** A random 20-character document ID, like the client SDKs' `doc()`. */
  newId(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.getRandomValues(new Uint8Array(40));
    let id = '';
    for (const byte of bytes) {
      // 62 * 4 = 248: rejecting bytes >= 248 keeps the choice uniform.
      if (byte < 248) id += alphabet[byte % 62];
      if (id.length === 20) break;
    }
    return id.length === 20 ? id : this.newId();
  }

  get project(): string {
    return this.projectId;
  }
}

/**
 * True if a create-only commit lost to another write of the same document: it found the document existing
 * (`ALREADY_EXISTS` / `FAILED_PRECONDITION`) or was aborted by contention (`ABORTED`, safe to retry).
 */
export const lostCreateRace = (error: unknown) =>
  error instanceof GoogleApiError &&
  ['ALREADY_EXISTS', 'FAILED_PRECONDITION', 'ABORTED'].includes(error.status);

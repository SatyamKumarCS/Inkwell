import { googleFetch, GoogleApiError, type AuthHeader } from './rest';

/** The parts of a Firebase Auth user the API needs. */
export interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  /** e.g. `google.com`; email-code accounts have none. */
  providerIds: string[];
}

interface RawUser {
  localId: string;
  email?: string;
  emailVerified?: boolean;
  providerUserInfo?: { providerId: string; rawId?: string }[];
}

const toAuthUser = (raw: RawUser): AuthUser => ({
  uid: raw.localId,
  email: raw.email ?? null,
  emailVerified: raw.emailVerified ?? false,
  providerIds: (raw.providerUserInfo ?? []).map((p) => p.providerId),
});

export class EmailExistsError extends Error {}

export interface LinkedProvider {
  providerId: string;
  rawId: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
}

/**
 * Firebase Auth admin operations over the Identity Toolkit REST API (the same endpoints the Admin SDK
 * uses). Works against the Auth emulator by swapping the base URL and using its admin token.
 */
export class IdentityToolkit {
  private readonly base: string;

  constructor(
    projectId: string,
    private readonly authHeader: AuthHeader,
    emulatorHost?: string,
  ) {
    this.base = emulatorHost
      ? `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/projects/${projectId}`
      : `https://identitytoolkit.googleapis.com/v1/projects/${projectId}`;
  }

  private call<T>(path: string, body: unknown): Promise<T> {
    return googleFetch<T>(`${this.base}${path}`, this.authHeader, { body });
  }

  private async lookup(body: unknown): Promise<AuthUser | null> {
    const { users } = await this.call<{ users?: RawUser[] }>('/accounts:lookup', body);
    const user = users?.[0];
    return user ? toAuthUser(user) : null;
  }

  lookupByEmail(email: string): Promise<AuthUser | null> {
    return this.lookup({ email: [email] });
  }

  lookupByProvider(providerId: string, rawId: string): Promise<AuthUser | null> {
    return this.lookup({ federatedUserId: [{ providerId, rawId }] });
  }

  async createUser(email: string): Promise<AuthUser> {
    try {
      const raw = await this.call<RawUser>('/accounts', { email, emailVerified: true });
      return { uid: raw.localId, email, emailVerified: true, providerIds: [] };
    } catch (error) {
      if (error instanceof GoogleApiError && error.reason.startsWith('EMAIL_EXISTS')) {
        throw new EmailExistsError(email);
      }
      throw error;
    }
  }

  async setEmailVerified(uid: string): Promise<AuthUser> {
    return toAuthUser(
      await this.call<RawUser>('/accounts:update', { localId: uid, emailVerified: true }),
    );
  }

  async linkProvider(uid: string, provider: LinkedProvider): Promise<AuthUser> {
    return toAuthUser(
      await this.call<RawUser>('/accounts:update', {
        localId: uid,
        linkProviderUserInfo: provider,
      }),
    );
  }
}

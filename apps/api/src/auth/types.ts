/** A verified identity from a sign-in provider (Google now, Apple later). */
export interface ProviderIdentity {
  /** Firebase provider id, e.g. `google.com` (later `apple.com`). */
  providerId: string;
  /** The provider's stable user id (`sub`). */
  providerUid: string;
  /** Verified email, already normalised. */
  email: string;
  displayName?: string;
  photoURL?: string;
}

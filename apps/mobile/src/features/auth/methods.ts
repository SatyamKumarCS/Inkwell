/** A name the sign-in provider shared, used to prefill the name screen. */
export interface NameHint {
  firstName?: string;
  lastName?: string;
}

/**
 * A one-tap sign-in provider. Email codes have their own two-step screens; providers plug in here so
 * the sign-in screen, routing gate and profile creation never need to know which one was used.
 */
export interface FederatedSignInMethod {
  id: 'google' | 'apple';
  label: string;
  /** Platform and configuration check, e.g. Google on Android only, Apple on iOS only. */
  isAvailable: () => boolean;
  /** Signs in to Firebase and resolves with any name the provider shared. */
  signIn: () => Promise<{ nameHint?: NameHint }>;
}

// Google (Android) is added once the real Firebase project is ready; Apple needs an Apple Developer account.
const federatedMethods: FederatedSignInMethod[] = [];

export function availableSignInMethods(): FederatedSignInMethod[] {
  return federatedMethods.filter((method) => method.isAvailable());
}

import type { Href } from 'expo-router';
import type { User } from '@inkwell/shared';

export type AuthStatus = 'initializing' | 'signedOut' | 'signedIn';
/** `loading` until the server confirms whether `users/{uid}` exists; `missing` means a new account. */
export type ProfileStatus = 'idle' | 'loading' | 'missing' | 'ready' | 'error';

export interface GateInput {
  authStatus: AuthStatus;
  profileStatus: ProfileStatus;
  profile: User | null;
}

/** Where the user is in the app's flow. The root layout shows exactly one route group per gate. */
export type Gate =
  | 'initializing'
  | 'signedOut'
  | 'loadingProfile'
  | 'needsProfile'
  | 'needsTour'
  | 'needsNotifications'
  | 'ready';

export const onboardingGates: readonly Gate[] = ['needsProfile', 'needsTour', 'needsNotifications'];

export function deriveGate(
  { authStatus, profileStatus, profile }: GateInput,
  { notificationPromptSupported }: { notificationPromptSupported: boolean },
): Gate {
  if (authStatus === 'initializing') return 'initializing';
  if (authStatus === 'signedOut') return 'signedOut';
  if (profileStatus === 'missing') return 'needsProfile';
  if (profileStatus !== 'ready' || !profile) return 'loadingProfile';
  if (!profile.onboarding.tourCompletedAt) return 'needsTour';
  if (notificationPromptSupported && !profile.onboarding.notificationsPromptedAt) {
    return 'needsNotifications';
  }
  return 'ready';
}

/**
 * The one route each gate shows. Every `Stack.Protected` redirects here, so when a gate changes (or the app
 * opens on a URL the gate doesn't allow) Expo Router never has to guess a destination.
 */
export function gateHref(gate: Gate): Href {
  switch (gate) {
    case 'initializing':
    case 'loadingProfile':
      return '/loading';
    case 'signedOut':
      return '/sign-in';
    case 'needsProfile':
      return '/name';
    case 'needsTour':
      return '/tour';
    case 'needsNotifications':
      return '/notifications';
    case 'ready':
      return '/';
  }
}

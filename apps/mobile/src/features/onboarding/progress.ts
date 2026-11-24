import { Paths, type OnboardingState } from '@inkwell/shared';

import { serverTimestamp, updateDocument } from '@/lib/db';

/**
 * Records an onboarding step on the user doc. Not awaited by callers: the local write updates the profile
 * listener immediately (so the next screen appears even offline) and syncs to the server later.
 */
export function markOnboardingStep(uid: string, step: keyof OnboardingState): void {
  updateDocument(Paths.user(uid), {
    [`onboarding.${step}`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((error: unknown) => {
    console.warn(`[onboarding] saving ${step} failed`, error);
  });
}

import {
  getAuth,
  signInWithCustomToken,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import { httpsCallable } from '@react-native-firebase/functions';
import {
  Callables,
  completeProfileResponseSchema,
  requestEmailCodeResponseSchema,
  verifyEmailCodeResponseSchema,
  type CompleteProfileRequest,
  type CompleteProfileResponse,
  type RequestEmailCodeResponse,
} from '@inkwell/shared';

import { appFunctions } from '@/lib/firebase';

interface Parser<T> {
  parse: (value: unknown) => T;
}

async function call<T>(name: string, data: object, response: Parser<T>): Promise<T> {
  const result = await httpsCallable(appFunctions(), name)(data);
  return response.parse(result.data);
}

export function requestEmailCode(email: string): Promise<RequestEmailCodeResponse> {
  return call(Callables.requestEmailCode, { email }, requestEmailCodeResponseSchema);
}

/** Exchanges the emailed code for a custom token and signs in with it. */
export async function signInWithEmailCode(email: string, code: string): Promise<void> {
  const { token } = await call(
    Callables.verifyEmailCode,
    { email, code },
    verifyEmailCodeResponseSchema,
  );
  await signInWithCustomToken(getAuth(), token);
}

export function completeProfile(names: CompleteProfileRequest): Promise<CompleteProfileResponse> {
  return call(Callables.completeProfile, names, completeProfileResponseSchema);
}

export function signOut(): Promise<void> {
  return firebaseSignOut(getAuth());
}

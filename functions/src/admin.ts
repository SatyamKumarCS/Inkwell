import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/** Lazily initialised so tests can call `initializeApp({ projectId })` first. */
function app(): App {
  return getApps()[0] ?? initializeApp();
}

export const db = () => getFirestore(app());
export const adminAuth = () => getAuth(app());

// Native modules that have no JS fallback under Jest. Tests that care about calls override these with
// jest.mocked(...) or their own jest.mock().
jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({ options: { projectId: 'demo-inkwell' } })),
}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signInWithCustomToken: jest.fn(),
  signOut: jest.fn(),
  connectAuthEmulator: jest.fn(),
}));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn((_db: unknown, path: string) => ({ path })),
  onSnapshot: jest.fn(() => jest.fn()),
  updateDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  getDocFromServer: jest.fn(),
  connectFirestoreEmulator: jest.fn(),
  collection: jest.fn((_db: unknown, path: string) => ({ path })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn((...args: unknown[]) => ({ where: args })),
  orderBy: jest.fn((...args: unknown[]) => ({ orderBy: args })),
  limit: jest.fn((n: number) => ({ limit: n })),
  setDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  deleteField: jest.fn(() => 'DELETE_FIELD'),
  getDocs: jest.fn(() => Promise.resolve({ docs: [], size: 0, metadata: { fromCache: false } })),
  writeBatch: jest.fn(() => ({ set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn(() => Promise.resolve()) })),
}));
jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(),
  connectFunctionsEmulator: jest.fn(),
}));
jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

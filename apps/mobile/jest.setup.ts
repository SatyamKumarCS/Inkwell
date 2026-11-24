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
}));
jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(),
  connectFunctionsEmulator: jest.fn(),
}));
jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

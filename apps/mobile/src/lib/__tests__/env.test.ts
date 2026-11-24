jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: '192.168.1.20:8081' } },
}));

describe('getEmulatorHost', () => {
  const original = process.env.EXPO_PUBLIC_EMULATOR_HOST;

  afterEach(() => {
    process.env.EXPO_PUBLIC_EMULATOR_HOST = original;
  });

  it('uses the Metro host by default', () => {
    delete process.env.EXPO_PUBLIC_EMULATOR_HOST;
    const { getEmulatorHost } = jest.requireActual<typeof import('../env')>('../env');
    expect(getEmulatorHost()).toBe('192.168.1.20');
  });

  it('prefers EXPO_PUBLIC_EMULATOR_HOST when set', () => {
    process.env.EXPO_PUBLIC_EMULATOR_HOST = '10.0.0.5';
    const { getEmulatorHost } = jest.requireActual<typeof import('../env')>('../env');
    expect(getEmulatorHost()).toBe('10.0.0.5');
  });
});

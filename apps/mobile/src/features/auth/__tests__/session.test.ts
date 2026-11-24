import { profileFromSnapshot } from '../session';

const ts = { seconds: 1, nanoseconds: 0 };
const userDoc = {
  createdAt: ts,
  updatedAt: ts,
  displayName: 'Ada Lovelace',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  photoURL: null,
  defaultSpaceId: 's1',
  settings: { theme: 'system', startOfWeek: 1 },
  fcmTokens: [],
  onboarding: {},
};

describe('profileFromSnapshot', () => {
  it('waits for the server before treating a cache miss as a new account', () => {
    expect(profileFromSnapshot({ exists: false, fromCache: true, data: undefined })).toEqual({
      profileStatus: 'loading',
      profile: null,
    });
    expect(profileFromSnapshot({ exists: false, fromCache: false, data: undefined })).toEqual({
      profileStatus: 'missing',
      profile: null,
    });
  });

  it('parses an existing profile (from cache too, so offline relaunches work)', () => {
    const result = profileFromSnapshot({ exists: true, fromCache: true, data: userDoc });
    expect(result.profileStatus).toBe('ready');
    expect(result.profile?.firstName).toBe('Ada');
  });

  it('reports an invalid doc as an error', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(
      profileFromSnapshot({ exists: true, fromCache: false, data: { firstName: 'Ada' } }),
    ).toEqual({ profileStatus: 'error', profile: null });
  });
});

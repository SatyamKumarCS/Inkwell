import { assertFirebaseTarget } from '../env';

describe('assertFirebaseTarget', () => {
  it('allows emulators with a demo project and real services with a real project', () => {
    expect(() => assertFirebaseTarget('demo-inkwell', true)).not.toThrow();
    expect(() => assertFirebaseTarget('inkwell-prod', false)).not.toThrow();
  });

  it('refuses to point the emulators at a real project', () => {
    expect(() => assertFirebaseTarget('inkwell-prod', true)).toThrow(/real "inkwell-prod"/);
  });

  it('refuses a release build that still has the demo config', () => {
    expect(() => assertFirebaseTarget('demo-inkwell', false)).toThrow(/GOOGLE_SERVICES_JSON/);
  });
});

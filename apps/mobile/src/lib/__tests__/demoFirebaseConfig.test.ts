/// <reference types="node" />
// Node types only for this test (it reads the demo config files); app code stays free of them.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Firebase Installations (used by the Functions SDK on Android) rejects any API key that doesn't match this
// pattern with "Please set a valid API key", even against the emulators. Keep the demo keys well-formed.
const FIREBASE_API_KEY = /^A[\w-]{38}$/;

const read = (file: string) => readFileSync(resolve(__dirname, '../../../firebase', file), 'utf8');

describe('demo Firebase configs', () => {
  it('Android demo config has a well-formed API key', () => {
    const json = JSON.parse(read('google-services.demo.json')) as {
      client: { api_key: { current_key: string }[] }[];
    };
    expect(json.client[0]?.api_key[0]?.current_key).toMatch(FIREBASE_API_KEY);
  });

  it('iOS demo config has a well-formed API key', () => {
    const key = /<key>API_KEY<\/key>\s*<string>([^<]*)<\/string>/.exec(
      read('GoogleService-Info.demo.plist'),
    )?.[1];
    expect(key).toMatch(FIREBASE_API_KEY);
  });

  it('both demo configs use the demo project', () => {
    expect(read('google-services.demo.json')).toContain('"project_id": "demo-inkwell"');
    expect(read('GoogleService-Info.demo.plist')).toContain('<string>demo-inkwell</string>');
  });
});

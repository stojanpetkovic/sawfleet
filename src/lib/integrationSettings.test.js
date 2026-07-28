import { describe, it, expect } from 'vitest';
import { getStoredOAuthSettings, saveStoredOAuthSettings, normalizeOAuthSettings } from './integrationSettings.js';

describe('integration settings storage', () => {
  it('normalizes OAuth field names', () => {
    expect(normalizeOAuthSettings({ googleClientId: 'abc', googleClientSecret: 'xyz' })).toEqual({
      clientId: 'abc',
      clientSecret: 'xyz',
    });
  });

  it('persists and reloads OAuth settings from storage', () => {
    const storage = new Map();
    const fakeStorage = {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
      removeItem(key) {
        storage.delete(key);
      },
    };

    const saved = saveStoredOAuthSettings({ clientId: 'id', clientSecret: 'secret' }, fakeStorage);
    expect(saved).toEqual({ clientId: 'id', clientSecret: 'secret' });
    expect(getStoredOAuthSettings(fakeStorage)).toEqual({ clientId: 'id', clientSecret: 'secret' });
  });
});

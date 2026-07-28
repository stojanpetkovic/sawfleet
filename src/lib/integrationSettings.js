const OAUTH_SETTINGS_STORAGE_KEY = 'sawfleet_google_oauth_settings';

export function normalizeOAuthSettings(raw = {}) {
  return {
    clientId: String(raw.clientId ?? raw.googleClientId ?? '').trim(),
    clientSecret: String(raw.clientSecret ?? raw.googleClientSecret ?? '').trim(),
  };
}

export function getStoredOAuthSettings(storage = typeof window !== 'undefined' ? window.localStorage : undefined) {
  if (!storage) return { clientId: '', clientSecret: '' };

  try {
    const raw = storage.getItem(OAUTH_SETTINGS_STORAGE_KEY);
    if (!raw) return { clientId: '', clientSecret: '' };

    return normalizeOAuthSettings(JSON.parse(raw));
  } catch {
    return { clientId: '', clientSecret: '' };
  }
}

export function saveStoredOAuthSettings(settings, storage = typeof window !== 'undefined' ? window.localStorage : undefined) {
  const normalized = normalizeOAuthSettings(settings);

  if (!storage) return normalized;

  try {
    storage.setItem(OAUTH_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage failures and keep the values in memory.
  }

  return normalized;
}

export function clearStoredOAuthSettings(storage = typeof window !== 'undefined' ? window.localStorage : undefined) {
  if (!storage) return;

  try {
    storage.removeItem(OAUTH_SETTINGS_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

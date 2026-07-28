export function getAppBaseUrl(defaultOrigin = typeof window !== 'undefined' ? window.location.origin : '') {
  const configured = import.meta.env.PUBLIC_SITE_URL;
  if (configured && configured.trim()) {
    return configured.replace(/\/$/, '');
  }
  return defaultOrigin || 'https://sftreeremoval.com';
}

export function getAuthRedirectUrl(path: string) {
  return new URL(path, getAppBaseUrl()).toString();
}

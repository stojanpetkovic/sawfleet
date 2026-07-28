export function getAppBaseUrl(defaultOrigin = typeof window !== 'undefined' ? window.location.origin : '') {
  const configured = import.meta.env.PUBLIC_SITE_URL;
  const runtimeOrigin = defaultOrigin || (typeof window !== 'undefined' ? window.location.origin : '');

  if (runtimeOrigin && /localhost|127\.0\.0\.1/.test(runtimeOrigin)) {
    return runtimeOrigin.replace(/\/$/, '');
  }

  if (configured && configured.trim()) {
    return configured.replace(/\/$/, '');
  }

  return runtimeOrigin || 'https://sftreeremoval.com';
}

export function getAuthRedirectUrl(path: string) {
  return new URL(path, getAppBaseUrl()).toString();
}

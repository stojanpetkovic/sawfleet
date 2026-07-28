export function parseHashParams(hash: string) {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(withoutHash);
  return Object.fromEntries(params.entries());
}

export function hasOAuthHash(hash: string) {
  return Boolean(hash && hash.includes('access_token='));
}

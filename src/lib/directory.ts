export function directoryLocationSlug(value?: string | null) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function directoryLocation(profile: any) {
  return [profile?.location_city, profile?.location_state].filter(Boolean).join(", ");
}

export function directoryProfileUrl(profile: any) {
  return `/contractors/profile/${encodeURIComponent(profile.slug)}`;
}

export function directoryLocationUrl(profile: any) {
  const state = directoryLocationSlug(profile?.location_state);
  const city = directoryLocationSlug(profile?.location_city);
  return city
    ? `/contractors/locations/${state}/${city}`
    : `/contractors/locations/${state}`;
}

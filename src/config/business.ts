/**
 * Everything the site says about the business, in one place: the header,
 * footer, structured data and the legal pages all read from here.
 */
export const business = {
  name: 'SF Tree Removal',
  url: 'https://sftreeremoval.com',
  city: 'Fort Lauderdale',
  region: 'FL',
  postalCode: '33301',
  country: 'US',
  areaServed: ['Miami-Dade County', 'Broward County', 'Palm Beach County'],
  /** Lead admin key (stojanpetkovic.com/admin → Sites). */
  leadsSiteKey: 'c430880ad59dc1084bd3d17066defb05',
  /** GA4 measurement ID, carried over from the previous site on this domain. */
  gaId: 'G-LG6F8P23QM',
} as const;

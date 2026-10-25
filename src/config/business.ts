/**
 * Everything the site says about the business, in one place: the header,
 * footer, structured data and the legal pages all read from here.
 */
export const business = {
  name: 'SF Tree Removal',
  url: 'https://sftreeremoval.com',
  description:
    'Free estimates for tree removal, emergency storm cleanup, trimming and stump grinding, active in the Fort Lauderdale area with permit rules, costs and guides for Miami-Dade, Broward and Palm Beach County. SF Tree Removal is an online service that connects property owners with independent tree care professionals.',
  /** The one-line explanation of the business model, shown wherever a visitor might assume we do the work. */
  disclosure:
    'SF Tree Removal is an online service that connects South Florida property owners with independent local tree care professionals. We are active in the Fort Lauderdale area and adding professionals in other areas, so outside it we try to match requests but cannot promise a response. We do not perform the work ourselves: the professional you choose agrees the scope, price and schedule with you directly.',
  areaServed: ['Miami-Dade County', 'Broward County', 'Palm Beach County'],
  /** Cities with their own page; they also feed the structured data. */
  cities: ['Miami', 'Fort Lauderdale', 'Hollywood', 'Pembroke Pines', 'Boca Raton', 'Pompano Beach', 'West Palm Beach', 'Boynton Beach', 'Jupiter', 'Miramar', 'Delray Beach', 'Coral Springs', 'Deerfield Beach', 'Davie', 'Miami Gardens', 'North Miami Beach', 'Cutler Bay', 'Hialeah', 'Miami Beach', 'Coral Gables', 'Homestead', 'Doral', 'Plantation', 'Weston', 'Sunrise', 'Wellington', 'Palm Beach Gardens', 'Lake Worth Beach'],
  /** The business's own profiles; they feed `sameAs` and the footer links. */
  profiles: {
    google: 'https://share.google/AP4fOCKjUZnJH6j20',
    instagram: 'https://www.instagram.com/sftreeremoval',
  },
  /** Lead admin key (webtano.com/admin → Sites). */
  leadsSiteKey: 'c430880ad59dc1084bd3d17066defb05',
  /** GA4 measurement ID, carried over from the previous site on this domain. */
  gaId: 'G-LG6F8P23QM',
} as const;

/** One node for the business everywhere in the structured data. */
export const businessId = `${business.url}/#business`;
export const websiteId = `${business.url}/#website`;

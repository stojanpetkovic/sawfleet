import { places } from '../data/places';

/**
 * Where the service can actually connect a request to a professional.
 *
 * Only the places listed in `activePlaceIds` have a pro behind them today.
 * Everywhere else the site says so plainly: the request is accepted and we
 * try to match it, but nothing is promised. Add a place id here when a pro
 * starts covering it, and every page, form and message follows.
 */
export const coverage = {
  activeLabel: 'Fort Lauderdale and the surrounding area',
  activePlaceIds: ['fort-lauderdale', 'plantation', 'sunrise', 'davie', 'hollywood', 'pompano-beach'],
  /** Counties with an active area inside them (the county page says so). */
  partialCounties: ['broward'],
  /** Where homeowners are asking and we have no pro yet, most wanted first. */
  priorityNeeds: ['miami', 'boca-raton', 'west-palm-beach', 'pembroke-pines', 'jupiter', 'miami-beach'],
} as const;

export const isActivePlace = (id: string) => (coverage.activePlaceIds as readonly string[]).includes(id);
export const isActiveName = (name: string) => places.some((p) => p.name === name && isActivePlace(p.id));
export const isActiveSlug = (slug: string) => {
  const p = places.find((x) => x.slug === slug);
  return p ? isActivePlace(p.id) : false;
};
export const activePlaces = () => places.filter((p) => isActivePlace(p.id));
export const waitingPlaces = () => places.filter((p) => !isActivePlace(p.id));
export const needPlaces = () => coverage.priorityNeeds.map((id) => places.find((p) => p.id === id)!).filter(Boolean);

/** One sentence that can sit under any promise to contact the visitor. */
export const coverageSentence =
  'We are active in the Fort Lauderdale area and adding professionals in other areas. Elsewhere we will try to match your request, but cannot promise a response.';

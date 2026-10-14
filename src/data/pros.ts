import type { CountyId } from './permits';

// Listed professionals. Details are supplied by each company and are NOT
// verified by SF Tree Removal; pages say so wherever they are shown.
export interface Pro {
  slug: string;
  name: string;
  sponsored: boolean;
  /** Short line under the name. */
  tagline: string;
  description: string[];
  services: string[];
  counties: CountyId[];
  /** Plain-words coverage, shown on cards and profiles. */
  area: string;
  /** Cities the company names as areas it serves. */
  cities: string[];
  /** Pages (place ids from places.ts) where the company is shown as the featured pro. */
  featuredIn: string[];
  /** Whether the Broward County page may feature the company. */
  featuredInCounty?: CountyId[];
  phone?: string;
  phoneHref?: string;
  website: string;
  instagram?: string;
  /** What the company says about itself; shown as the company's own statements. */
  claims: string[];
}

export const pros: Pro[] = [
  {
    slug: 'tree-jaws',
    name: 'Tree Jaws',
    sponsored: true,
    tagline: 'Tree service company in Fort Lauderdale',
    description: [
      'Tree Jaws is a tree service company that serves Fort Lauderdale and the surrounding area in Broward County. Ask whether they cover your exact address.',
      'The company lists tree removal (including crane-assisted and large removals), emergency and storm response, trimming and pruning, stump grinding, arborist services and reports, and hurricane tree preparation. It also offers help with tree removal permits.',
    ],
    services: [
      'Tree removal, including crane-assisted removals',
      'Emergency tree removal and storm response',
      'Tree trimming and pruning',
      'Stump grinding',
      'Arborist services and reports',
      'Hurricane tree preparation',
      'Permit assistance',
    ],
    counties: ['broward'],
    area: 'Fort Lauderdale and surrounding area',
    cities: ['Fort Lauderdale'],
    featuredIn: ['fort-lauderdale', 'plantation', 'sunrise', 'davie', 'hollywood', 'pompano-beach'],
    featuredInCounty: ['broward'],
    phone: '(954) 540-0139',
    phoneHref: 'tel:+19545400139',
    website: 'https://treejaws.com/',
    instagram: 'https://www.instagram.com/tree_jaws/',
    claims: [
      'Licensed, bonded and insured',
      'Workers’ compensation coverage for crews',
      'BBB accredited business',
      'ISA certified arborist and tree risk assessment credentials',
      'Emergency response available 24/7',
    ],
  },
];

export const proDisclosure =
  'Sponsored listing: this company has a featured placement. Details are supplied by the company and have not been verified by SF Tree Removal. A listing is not a recommendation or a guarantee of license, insurance or quality, so ask for proof before work starts.';

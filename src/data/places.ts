import type { CountyId } from './permits';

// Every place with its own page, and where it is. The map, the area hub and the
// lists all read from here, so a new city only has to be added once.
export interface Place {
  id: string;
  name: string;
  county: CountyId;
  slug: string; // path under /areas/
  lat: number;
  lon: number;
}

export const places: Place[] = [
  // Miami-Dade
  { id: 'miami', name: 'Miami', county: 'miami-dade', slug: 'miami-tree-removal', lat: 25.7617, lon: -80.1918 },
  { id: 'miami-beach', name: 'Miami Beach', county: 'miami-dade', slug: 'miami-beach-tree-removal', lat: 25.7907, lon: -80.13 },
  { id: 'coral-gables', name: 'Coral Gables', county: 'miami-dade', slug: 'coral-gables-tree-removal', lat: 25.7215, lon: -80.2684 },
  { id: 'hialeah', name: 'Hialeah', county: 'miami-dade', slug: 'hialeah-tree-removal', lat: 25.8576, lon: -80.2781 },
  { id: 'doral', name: 'Doral', county: 'miami-dade', slug: 'doral-tree-removal', lat: 25.8195, lon: -80.3553 },
  { id: 'miami-gardens', name: 'Miami Gardens', county: 'miami-dade', slug: 'miami-gardens-tree-removal', lat: 25.942, lon: -80.2456 },
  { id: 'north-miami-beach', name: 'North Miami Beach', county: 'miami-dade', slug: 'north-miami-beach-tree-removal', lat: 25.9331, lon: -80.1625 },
  { id: 'cutler-bay', name: 'Cutler Bay', county: 'miami-dade', slug: 'cutler-bay-tree-removal', lat: 25.5808, lon: -80.3468 },
  { id: 'homestead', name: 'Homestead', county: 'miami-dade', slug: 'homestead-tree-removal', lat: 25.4687, lon: -80.4776 },
  // Broward
  { id: 'fort-lauderdale', name: 'Fort Lauderdale', county: 'broward', slug: 'fort-lauderdale-tree-removal', lat: 26.1224, lon: -80.1373 },
  { id: 'hollywood', name: 'Hollywood', county: 'broward', slug: 'hollywood-tree-service', lat: 26.0112, lon: -80.1495 },
  { id: 'pembroke-pines', name: 'Pembroke Pines', county: 'broward', slug: 'pembroke-pines-tree-removal', lat: 26.0, lon: -80.29 },
  { id: 'miramar', name: 'Miramar', county: 'broward', slug: 'miramar-tree-removal', lat: 25.98, lon: -80.27 },
  { id: 'pompano-beach', name: 'Pompano Beach', county: 'broward', slug: 'pompano-beach-tree-removal', lat: 26.2379, lon: -80.1248 },
  { id: 'coral-springs', name: 'Coral Springs', county: 'broward', slug: 'coral-springs-tree-removal', lat: 26.2712, lon: -80.2706 },
  { id: 'deerfield-beach', name: 'Deerfield Beach', county: 'broward', slug: 'deerfield-beach-tree-removal', lat: 26.3184, lon: -80.0998 },
  { id: 'davie', name: 'Davie', county: 'broward', slug: 'davie-tree-removal', lat: 26.0765, lon: -80.2521 },
  { id: 'plantation', name: 'Plantation', county: 'broward', slug: 'plantation-tree-removal', lat: 26.1276, lon: -80.2331 },
  { id: 'weston', name: 'Weston', county: 'broward', slug: 'weston-tree-removal', lat: 26.1004, lon: -80.3998 },
  { id: 'sunrise', name: 'Sunrise', county: 'broward', slug: 'sunrise-tree-removal', lat: 26.167, lon: -80.2564 },
  // Palm Beach
  { id: 'boca-raton', name: 'Boca Raton', county: 'palm-beach', slug: 'boca-raton-tree-removal', lat: 26.3587, lon: -80.0831 },
  { id: 'delray-beach', name: 'Delray Beach', county: 'palm-beach', slug: 'delray-beach-tree-removal', lat: 26.4615, lon: -80.0728 },
  { id: 'boynton-beach', name: 'Boynton Beach', county: 'palm-beach', slug: 'boynton-beach-tree-removal', lat: 26.5318, lon: -80.0905 },
  { id: 'lake-worth-beach', name: 'Lake Worth Beach', county: 'palm-beach', slug: 'lake-worth-beach-tree-removal', lat: 26.6168, lon: -80.0568 },
  { id: 'west-palm-beach', name: 'West Palm Beach', county: 'palm-beach', slug: 'west-palm-beach-tree-removal', lat: 26.7153, lon: -80.0534 },
  { id: 'wellington', name: 'Wellington', county: 'palm-beach', slug: 'wellington-tree-removal', lat: 26.6618, lon: -80.2684 },
  { id: 'palm-beach-gardens', name: 'Palm Beach Gardens', county: 'palm-beach', slug: 'palm-beach-gardens-tree-removal', lat: 26.8234, lon: -80.1387 },
  { id: 'jupiter', name: 'Jupiter', county: 'palm-beach', slug: 'jupiter-tree-removal', lat: 26.9342, lon: -80.0942 },
];

export const countyPages: Record<CountyId, string> = {
  'miami-dade': '/areas/miami-dade-county-tree-removal/',
  broward: '/areas/broward-county-tree-removal/',
  'palm-beach': '/areas/palm-beach-county-tree-removal/',
};

export const placeHref = (p: Place) => `/areas/${p.slug}/`;
export const placesIn = (c: CountyId) => places.filter((p) => p.county === c);

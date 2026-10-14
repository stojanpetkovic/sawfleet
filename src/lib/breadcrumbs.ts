import { guides } from '../config/guides';

export interface Crumb {
  name: string;
  href: string;
}

/** Display names for every section of the site, keyed by path. */
const names: Record<string, string> = {
  '/about-us/': 'About Us',
  '/areas/': 'Service Areas',
  '/areas/miami-tree-removal/': 'Miami',
  '/areas/fort-lauderdale-tree-removal/': 'Fort Lauderdale',
  '/areas/hollywood-tree-service/': 'Hollywood',
  '/areas/pembroke-pines-tree-removal/': 'Pembroke Pines',
  '/areas/boca-raton-tree-removal/': 'Boca Raton',
  '/areas/pompano-beach-tree-removal/': 'Pompano Beach',
  '/areas/west-palm-beach-tree-removal/': 'West Palm Beach',
  '/areas/boynton-beach-tree-removal/': 'Boynton Beach',
  '/areas/jupiter-tree-removal/': 'Jupiter',
  '/areas/miami-gardens-tree-removal/': 'Miami Gardens',
  '/areas/north-miami-beach-tree-removal/': 'North Miami Beach',
  '/areas/cutler-bay-tree-removal/': 'Cutler Bay',
  '/areas/hialeah-tree-removal/': 'Hialeah',
  '/areas/miami-beach-tree-removal/': 'Miami Beach',
  '/areas/coral-gables-tree-removal/': 'Coral Gables',
  '/areas/homestead-tree-removal/': 'Homestead',
  '/areas/doral-tree-removal/': 'Doral',
  '/areas/plantation-tree-removal/': 'Plantation',
  '/areas/weston-tree-removal/': 'Weston',
  '/areas/sunrise-tree-removal/': 'Sunrise',
  '/areas/wellington-tree-removal/': 'Wellington',
  '/areas/palm-beach-gardens-tree-removal/': 'Palm Beach Gardens',
  '/areas/lake-worth-beach-tree-removal/': 'Lake Worth Beach',
  '/areas/miramar-tree-removal/': 'Miramar',
  '/areas/delray-beach-tree-removal/': 'Delray Beach',
  '/areas/coral-springs-tree-removal/': 'Coral Springs',
  '/areas/deerfield-beach-tree-removal/': 'Deerfield Beach',
  '/areas/davie-tree-removal/': 'Davie',
  '/areas/miami-dade-county-tree-removal/': 'Miami-Dade County',
  '/areas/broward-county-tree-removal/': 'Broward County',
  '/areas/palm-beach-county-tree-removal/': 'Palm Beach County',
  '/certified-arborist/': 'Arborist Assessments',
  '/contact-us/': 'Contact Us',
  '/emergency-tree-removal/': 'Emergency Tree Removal',
  '/faq/': 'FAQ',
  '/hurricane-checklist/': 'Hurricane Checklist',
  '/hurricane-checklist/thanks/': 'Download',
  '/find-a-pro/': 'Find a Pro',
  '/find-a-pro/tree-jaws/': 'Tree Jaws',
  '/find-a-pro/fort-lauderdale/': 'Fort Lauderdale',
  '/for-pros/': 'For Pros',
  '/permit-checker/': 'Permit Checker',
  '/how-it-works/': 'How It Works',
  '/free-tree-removal/': 'Free Tree Removal',
  '/stump-grinding/': 'Stump Grinding',
  '/tree-trimming/': 'Tree Trimming',
  '/privacy-policy/': 'Privacy Policy',
  '/terms/': 'Terms & Conditions',
  '/thank-you/': 'Thank You',
  '/tree-care-guides/': 'Tree Care Guides',
  '/tree-removal/': 'Tree Removal',
  '/tree-removal-permits/': 'Tree Removal Permits',
  '/tree-services/': 'Tree Services',
  '/404/': 'Page Not Found',
};
for (const g of guides) names[`/tree-care-guides/${g.slug}/`] = g.title;

/** Home → … → this page, built from the URL so it can never disagree with it. */
export function breadcrumbsFor(pathname: string): Crumb[] {
  if (pathname === '/') return [];
  const trail: Crumb[] = [{ name: 'Home', href: '/' }];
  const parts = pathname.split('/').filter(Boolean);
  let path = '/';
  for (const part of parts) {
    path += `${part}/`;
    const name = names[path];
    if (name) trail.push({ name, href: path });
  }
  return trail;
}

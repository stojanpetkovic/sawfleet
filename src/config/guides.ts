/** The tree care guides, newest first. Pages live in src/pages/tree-care-guides/<slug>/. */
import type { PhotoKey } from './photos';

export interface Guide {
  slug: string;
  title: string;
  description: string;
  published: string;
  readMinutes: number;
  /** Photo key from src/config/photos.ts, shown in the header and on cards. */
  image: PhotoKey;
}

export const guides: Guide[] = [
  {
    slug: 'tree-removal-after-hurricane',
    title: 'Tree Removal After a Hurricane: What to Do Safely',
    description:
      'What to do when a tree falls or is damaged in a hurricane: safety first, power lines, insurance photos, avoiding storm chasers and how to get help.',
    published: '2026-10-14',
    readMinutes: 6,
    image: 'storm-uproot',
  },
  {
    slug: 'broward-county-tree-removal-permit',
    title: 'Tree Removal Permits in Broward County',
    description:
      'How tree removal permits work in Broward County: county versus city rules, the 3-inch license, exemptions, state law and who to call.',
    published: '2026-10-14',
    readMinutes: 5,
    image: 'climber-rope',
  },
  {
    slug: 'miami-dade-county-tree-removal-permit',
    title: 'Tree Removal Permits in Miami-Dade County',
    description:
      'How tree removal permits work in Miami-Dade County: the county tree code, single-family exemptions, pruning rules, replacement and how to check a tree.',
    published: '2026-10-14',
    readMinutes: 5,
    image: 'crane-lift',
  },
  {
    slug: 'palm-beach-county-tree-removal-permit',
    title: 'Tree Removal Permits in Palm Beach County',
    description:
      'How tree removal permits work in Palm Beach County: county versus city rules, which sites need a permit, HOAs, prohibited species and who to contact.',
    published: '2026-10-14',
    readMinutes: 5,
    image: 'ladder-oak',
  },
  {
    slug: 'signs-a-tree-needs-to-be-removed',
    title: '8 Warning Signs a Tree Needs to Be Removed',
    description:
      'How to tell a dead, dying or dangerous tree from a healthy one: eight warning signs, what to check yourself and when to call an arborist.',
    published: '2026-10-14',
    readMinutes: 5,
    image: 'broken-tree',
  },
  {
    slug: 'tree-removal-cost-south-florida',
    title: 'How Much Does Tree Removal Cost in South Florida?',
    description:
      'What drives the price of tree removal in South Florida: tree size, location, access, cranes, stump grinding and permits, plus how to get an accurate estimate.',
    published: '2026-10-03',
    readMinutes: 6,
    image: 'trunk-bucket',
  },
  {
    slug: 'do-i-need-a-permit-to-remove-a-tree',
    title: 'Do I Need a Permit to Remove a Tree in South Florida?',
    description:
      'When a tree removal permit is required in Miami-Dade, Broward and Palm Beach County, the Florida exemption for dangerous trees, and how to avoid fines.',
    published: '2026-10-03',
    readMinutes: 5,
    image: 'brick-house-climber',
  },
  {
    slug: 'hurricane-tree-preparation',
    title: 'How to Prepare Your Trees for Hurricane Season',
    description:
      'A practical checklist for getting trees ready before hurricane season in South Florida, what to look for, and what to do safely after a storm.',
    published: '2026-10-03',
    readMinutes: 6,
    image: 'canopy-climber',
  },
  {
    slug: 'what-is-an-arborist',
    title: 'What Is an Arborist, and When Do You Need One?',
    description:
      'What a certified arborist does, how it differs from a tree removal crew, and when an arborist assessment saves you money or a permit headache.',
    published: '2026-10-03',
    readMinutes: 4,
    image: 'arborist-inspect',
  },
];

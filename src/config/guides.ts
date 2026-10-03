/** The tree care guides, newest first. Pages live in src/pages/tree-care-guides/<slug>/. */
export interface Guide {
  slug: string;
  title: string;
  description: string;
  published: string;
  readMinutes: number;
}

export const guides: Guide[] = [
  {
    slug: 'tree-removal-cost-south-florida',
    title: 'How Much Does Tree Removal Cost in South Florida?',
    description:
      'What drives the price of tree removal in South Florida: tree size, location, access, cranes, stump grinding and permits, plus how to get an accurate estimate.',
    published: '2026-10-03',
    readMinutes: 6,
  },
  {
    slug: 'do-i-need-a-permit-to-remove-a-tree',
    title: 'Do I Need a Permit to Remove a Tree in South Florida?',
    description:
      'When a tree removal permit is required in Miami-Dade, Broward and Palm Beach County, the Florida exemption for dangerous trees, and how to avoid fines.',
    published: '2026-10-03',
    readMinutes: 5,
  },
  {
    slug: 'hurricane-tree-preparation',
    title: 'How to Prepare Your Trees for Hurricane Season',
    description:
      'A practical checklist for getting trees ready before hurricane season in South Florida, what to look for, and what to do safely after a storm.',
    published: '2026-10-03',
    readMinutes: 6,
  },
  {
    slug: 'what-is-an-arborist',
    title: 'What Is an Arborist, and When Do You Need One?',
    description:
      'What a certified arborist does, how it differs from a tree removal crew, and when an arborist assessment saves you money or a permit headache.',
    published: '2026-10-03',
    readMinutes: 4,
  },
];

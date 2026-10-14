// What each place says about removing a tree on private property. Every entry
// names the page it was read from; "confidence" says how solid that source is.
// Rules change, so the tool always sends people to the source and to the city.

export type CountyId = 'miami-dade' | 'broward' | 'palm-beach';
/** permit: usually needed. size: depends on size or species. exempt: typical single-family yard trees are exempt, with limits. ask: own rules, details not confirmed. */
export type Status = 'permit' | 'size' | 'exempt' | 'ask';
export type Confidence = 'official' | 'partial' | 'general';

export interface Jurisdiction {
  id: string;
  name: string;
  county: CountyId;
  /** Our own page for the place, when there is one. */
  page?: string;
  status: Status;
  /** One-line answer shown in the table and the result. */
  headline: string;
  /** What the source says, in plain words. */
  summary: string;
  palms?: string;
  dead?: string;
  invasive?: string;
  publicTrees?: string;
  source: { label: string; url: string };
  confidence: Confidence;
  phone?: string;
}

export const counties: Record<CountyId, string> = {
  'miami-dade': 'Miami-Dade County',
  broward: 'Broward County',
  'palm-beach': 'Palm Beach County',
};

export const stateRule = {
  label: 'Florida Statute 163.045',
  url: 'https://m.flsenate.gov/Statutes/163.045',
  text: 'On residential property (a detached single-family home), a local government may not require a permit, application, fee or replacement tree to prune, trim or remove a tree when the owner has documentation from an ISA certified arborist or a Florida licensed landscape architect that the tree poses an unacceptable risk to people or property. It does not cover mangroves, condominiums, common areas or vacant land.',
};

export const jurisdictions: Jurisdiction[] = [
  // ---- Miami-Dade ----
  {
    id: 'miami-dade-county', name: 'Miami-Dade County (unincorporated and cities without their own rules)', county: 'miami-dade',
    page: '/areas/miami-dade-county-tree-removal/', status: 'exempt', confidence: 'official',
    headline: 'Yard trees at an existing single-family home are generally exempt if they are not specimen trees or in a natural forest community.',
    summary: 'The county environmental code (Chapter 24) makes it unlawful to remove a tree without a county permit unless an exemption applies. Exemptions include trees in the yard of an existing single-family residence, if they are not in a natural forest community and not specimen trees (trunk 18 inches or more), and not in county rights-of-way. Cities with their own ordinance handle most residential removals themselves.',
    dead: 'Dead trees are generally exempt outside natural forest communities; confirm with the county tree program.',
    invasive: 'Many species are on the county exempt or prohibited lists; the county will check a tree if you send photos, the address and the trunk diameter.',
    publicTrees: 'Trees in county rights-of-way next to a home are not covered by the yard exemption.',
    source: { label: 'Miami-Dade tree removal permit information', url: 'https://www.miamidade.gov/resources/economy/permits/documents/tree-removal.pdf' },
    phone: '305-372-6574',
  },
  {
    id: 'miami', name: 'Miami', county: 'miami-dade', page: '/areas/miami-tree-removal/', status: 'permit', confidence: 'partial',
    headline: 'A permit is required before removing, relocating, root pruning or heavily trimming a protected tree.',
    summary: 'Under Chapter 17 (tree protection), the city requires a permit before removing, relocating, root pruning or trimming more than 25% of a tree. A tree counts if it is at least 12 feet tall with a trunk of at least 2 inches; specimen trees (18 inches or more) get stricter treatment. Work on trees in the city right-of-way needs a separate permit. The city FAQ is dated 2015, so confirm the current process.',
    publicTrees: 'Work on trees, plants or shrubs in the city right-of-way (between sidewalk and street) needs its own permit.',
    source: { label: 'City of Miami tree FAQ (2015)', url: 'https://archive.miami.gov/planning/docs/trees/FAQs_updated_110915.pdf' },
  },
  {
    id: 'miami-beach', name: 'Miami Beach', county: 'miami-dade', status: 'permit', confidence: 'official',
    headline: 'A tree work permit is required to remove or relocate any tree or palm, with few exceptions.',
    summary: 'Miami Beach requires an approved tree work permit to relocate or remove any tree or palm, with exceptions listed in its tree ordinance. Removal must be justified, and relocation or replacement is expected. Applicants usually provide a tree survey, a disposition and an arborist report by an ISA or ASCA certified arborist.',
    palms: 'Palms are covered, the same as trees.',
    publicTrees: 'Swale trees are maintained by the adjacent owner, but removing one still needs a tree removal permit from Urban Forestry.',
    source: { label: 'Miami Beach: remove or relocate my tree', url: 'https://www.miamibeachfl.gov/city-hall/environmental-sustainability/urban-forestry/remove-or-relocate-my-tree/' },
  },
  {
    id: 'doral', name: 'Doral', county: 'miami-dade', status: 'ask', confidence: 'partial',
    headline: 'Doral has its own tree permit process and a published list of exemptions.',
    summary: 'The City of Doral runs its own tree permits through Public Works and publishes a document of permit exemptions. Check that list and the permit page before you cut.',
    source: { label: 'City of Doral tree permits', url: 'https://www.cityofdoral.com/Departments/Public-Works-Department/Tree-Permits' },
  },
  {
    id: 'coral-gables', name: 'Coral Gables', county: 'miami-dade', status: 'ask', confidence: 'partial',
    headline: 'Coral Gables has strict tree rules; removal from the public right-of-way needs a separate permit.',
    summary: 'The City Beautiful protects its tree canopy. Removing or relocating trees from the public right-of-way needs a separate tree removal permit under Chapter 82 of the city code, and the city has directed tree surveys and protection measures for demolition and design review. Residential thresholds were not confirmed, so ask the city.',
    publicTrees: 'A tree removal permit under Chapter 82, Article II is needed to remove or relocate trees in the public right-of-way.',
    source: { label: 'City of Coral Gables', url: 'https://www.coralgables.com/' },
  },
  {
    id: 'hialeah', name: 'Hialeah', county: 'miami-dade', status: 'ask', confidence: 'general',
    headline: 'Hialeah rules were not confirmed. The county code is the baseline; ask the city.',
    summary: 'We could not confirm Hialeah’s own tree rules from an official source. The county rules above are the baseline, and the county tree program can tell you whether the city or the county has jurisdiction for your address.',
    source: { label: 'Miami-Dade tree removal permit information', url: 'https://www.miamidade.gov/resources/economy/permits/documents/tree-removal.pdf' },
    phone: '305-372-6574',
  },
  // ---- Broward ----
  {
    id: 'broward-county', name: 'Broward County (unincorporated area and cities that use the county program)', county: 'broward',
    page: '/areas/broward-county-tree-removal/', status: 'size', confidence: 'partial',
    headline: 'The county Tree Preservation Program asks for a license to remove trees of about 3 inches or more, with exemptions.',
    summary: 'The county program covers the unincorporated Broward Municipal Services District, county-controlled sites and some cities (the county names Lauderdale-by-the-Sea, Tamarac and Wilton Manors). A Tree Removal License is needed for trees with a trunk of about 3 inches or more at 4.5 feet, with exemptions that include nuisance trees, hazard trees and trees near power lines. The county FAQ was last updated in 2019, so call to confirm.',
    dead: 'Hazard and nuisance trees are among the county exemptions; call to confirm what documentation is needed.',
    source: { label: 'Broward County Tree Preservation Program', url: 'https://broward.org/Environment/TreePreservation/Pages/TreeLicenses.aspx' },
    phone: '954-519-1483',
  },
  {
    id: 'fort-lauderdale', name: 'Fort Lauderdale', county: 'broward', page: '/areas/fort-lauderdale-tree-removal/', status: 'size', confidence: 'partial',
    headline: 'A permit is generally needed for a tree of 8 inches or more at trunk height, or a palm with 8 feet of clear trunk, on a developed single-family lot.',
    summary: 'City guidance sets the residential threshold at a tree of at least 8 inches DBH on a developed one-family lot not planned for redevelopment, or a palm with at least 8 feet of clear trunk. Properties planned for redevelopment need a permit at 3 inches DBH. The city publishes a list of species that need no permit or replacement (Australian pine, melaleuca, Norfolk Island pine, carrotwood, schefflera and others). The guidance is undated, so confirm current thresholds and fees.',
    palms: 'Palms with at least 8 feet of clear trunk are covered.',
    invasive: 'The city list of exempt species includes Australian pine, melaleuca, Norfolk Island pine, carrotwood and schefflera.',
    source: { label: 'Fort Lauderdale tree permit guidance', url: 'https://fortlauderdale.gov/home/showpublisheddocument/6376/636262256268530000' },
  },
  {
    id: 'hollywood', name: 'Hollywood', county: 'broward', page: '/areas/hollywood-tree-service/', status: 'ask', confidence: 'general',
    headline: 'Hollywood generally requires a permit before removing a tree; details were not confirmed from the city.',
    summary: 'Hollywood has a tree preservation ordinance and generally requires a permit before a tree is removed. We could not open the city’s own pages to confirm thresholds, so ask the city’s building or planning department.',
    source: { label: 'City of Hollywood', url: 'https://www.hollywoodfl.org/' },
  },
  {
    id: 'pembroke-pines', name: 'Pembroke Pines', county: 'broward', page: '/areas/pembroke-pines-tree-removal/', status: 'permit', confidence: 'official',
    headline: 'A permit is required to remove or relocate a tree on residential or commercial property.',
    summary: 'The city says a permit is needed before removing or relocating a tree, and work cannot start until it is approved. The application asks for an HOA approval letter if applicable, a sketch showing the trees, color photos, the fee, and a Sunshine 811 locate. If a tree is removed, a replacement must be installed within 30 days.',
    source: { label: 'Pembroke Pines tree permit application', url: 'https://ppines.com/DocumentCenter/View/18744' },
    phone: '954-392-2100',
  },
  {
    id: 'miramar', name: 'Miramar', county: 'broward', page: '/areas/miramar-tree-removal/', status: 'permit', confidence: 'official',
    headline: 'A permit is required before most residential tree removals; the application is notarized and may need HOA approval.',
    summary: 'Miramar handles residential tree removal or relocation through Planning and Zoning. Submitting the application does not authorize removal; work starts only when the permit is issued. The application asks for HOA approval where one applies and a Sunshine 811 locate, and lists fees by number of trees.',
    source: { label: 'City of Miramar: tree care, legal issues', url: 'https://www.miramarfl.gov/Departments/Building-Planning-Zoning/Land-Planning-Services/Tree-Care/Legal-Issues' },
    phone: '954-602-3264',
  },
  {
    id: 'pompano-beach', name: 'Pompano Beach', county: 'broward', page: '/areas/pompano-beach-tree-removal/', status: 'permit', confidence: 'official',
    headline: 'A tree permit is required before removal, relocation or substantial alteration of a tree.',
    summary: 'The city’s zoning code requires a tree permit before removing, relocating or substantially altering trees. Its instructions say single-family owners may apply themselves and other properties use a licensed tree contractor. The city can require replacement trees, and its rules restrict severe pruning and topping. The city’s own instructions are an older outline, so confirm the current process.',
    palms: 'Palms can be covered; ask the city.',
    source: { label: 'Pompano Beach tree permit instructions', url: 'https://cdn.pompanobeachfl.gov/city/pages/planning_zoning/tree_permit_instructions.pdf' },
    phone: '954-786-4926',
  },
  {
    id: 'coral-springs', name: 'Coral Springs', county: 'broward', page: '/areas/coral-springs-tree-removal/', status: 'permit', confidence: 'official',
    headline: 'A residential tree removal permit is needed for single-family and duplex properties; HOA approval is part of the application.',
    summary: 'The city’s residential tree removal permit has no fee for single-family and duplex properties. The application includes HOA approval, a survey or sketch showing the trees, and the replacement trees to be planted. Replacement is expected within six months of approval. Multi-family and commercial properties use a separate commercial permit.',
    source: { label: 'Coral Springs residential tree removal', url: 'https://www.coralsprings.gov/Government/Departments/Community-Development/Landscaping/Residential-Tree-Removal' },
    phone: '954-344-1117',
  },
  {
    id: 'davie', name: 'Davie', county: 'broward', page: '/areas/davie-tree-removal/', status: 'permit', confidence: 'official',
    headline: 'A tree removal or relocation permit is needed in most situations, but trimming and many invasive species do not need one.',
    summary: 'The town says a tree removal or relocation permit is required in most situations and that the application is inexpensive and can be completed by the homeowner with help from a landscape inspector. Pruning does not need a permit, though a licensed arborist is recommended. Invasive exotic species listed in the town code generally do not need a permit.',
    invasive: 'Invasive exotic species listed in the town code generally do not need a permit, unless removal would drop the property below its required tree count.',
    source: { label: 'Town of Davie tree FAQ', url: 'https://www.davie-fl.gov/m/faq?cat=23' },
    phone: '954-797-1072',
  },
  {
    id: 'plantation', name: 'Plantation', county: 'broward', status: 'permit', confidence: 'official',
    headline: 'A permit and replacement are required unless the owner has Florida Statute 163.045 documentation.',
    summary: 'Plantation applies the state exemption: a single-family owner with an ISA arborist or Florida landscape architect report that the tree is a danger needs no permit or replacement. Without it, the owner applies for a tree removal permit and mitigates under city code. The application asks for species, size and condition, a photo (or an arborist report if the tree is not dead or an imminent threat), a boundary survey and replacement trees.',
    dead: 'For a dead tree or an imminent threat, a photo can support the application.',
    source: { label: 'Plantation: Florida Statute tree removal', url: 'https://www.plantation.org/government/departments/planning-zoning-economic-development/environmental-landscape-division/fl-statute-tree-removal' },
  },
  {
    id: 'weston', name: 'Weston', county: 'broward', status: 'permit', confidence: 'official',
    headline: 'Weston has a strict tree preservation ordinance; removal needs a permit and work must be done by a registered tree service.',
    summary: 'The City of Weston regulates trees under Chapter 122 and describes it as very strict. Removals go through a permit, with preservation, relocation, replacement or a payment into the tree trust. Unless you do the work yourself, trimming, removal and root pruning must be done by a tree service registered with the city. Contact the Tree Preservation Division to confirm what applies.',
    source: { label: 'City of Weston: tree permits and registration', url: 'https://www.westonfl.org/government/landscaping/tree-permits-registration' },
    phone: '954-385-0500',
  },
  {
    id: 'deerfield-beach', name: 'Deerfield Beach', county: 'broward', page: '/areas/deerfield-beach-tree-removal/', status: 'ask', confidence: 'general',
    headline: 'Deerfield Beach rules were not confirmed. Ask the city; the state hazard-tree exemption can apply.',
    summary: 'We could not confirm the city’s tree rules from an official source. Ask the city’s development services or planning department whether your tree needs a permit.',
    source: { label: 'City of Deerfield Beach', url: 'https://www.deerfield-beach.com/' },
  },
  // ---- Palm Beach ----
  {
    id: 'palm-beach-county', name: 'Palm Beach County (unincorporated areas)', county: 'palm-beach',
    page: '/areas/palm-beach-county-tree-removal/', status: 'ask', confidence: 'official',
    headline: 'Non-residential sites need a Tree Removal and Replacement permit; single-family lots in developments need one for buffer and common-area trees.',
    summary: 'In unincorporated areas the county’s land development code applies. The county zoning FAQ says all non-residential sites need a Tree Removal and Replacement permit, and that in single-family developments a permit is needed for perimeter buffer and common-area trees. It does not state a permit requirement for every tree on a single-family lot, so ask the county. Prohibited species such as Australian pine, Brazilian pepper and melaleuca must be removed from development sites.',
    invasive: 'Australian pine, Brazilian pepper and melaleuca are prohibited species on development sites.',
    source: { label: 'Palm Beach County zoning landscape FAQ', url: 'https://discover.pbc.gov/pzb/FAQPages/Zoning-Landscape.aspx' },
    phone: '561-233-2400',
  },
  {
    id: 'boca-raton', name: 'Boca Raton', county: 'palm-beach', page: '/areas/boca-raton-tree-removal/', status: 'exempt', confidence: 'official',
    headline: 'The city says no permit is required for trees within the property lines of single-family homes and owner-occupied two-family homes.',
    summary: 'Boca Raton’s environmental office says City Code Chapter 27 (Vegetation) does not apply to trees or landscaping within the property lines of single-family homes, owner-occupied two-family homes, or the enclosed courtyards of multi-family townhomes, so no city permit is required there. Other property types, trees outside property lines, historic or coastal areas and your HOA may have rules.',
    publicTrees: 'The exemption is for trees inside your property lines; public trees and rights-of-way are different.',
    source: { label: 'City of Boca Raton FAQ', url: 'https://myboca.us/m/faq?cat=64' },
    phone: '561-393-7700',
  },
  {
    id: 'delray-beach', name: 'Delray Beach', county: 'palm-beach', page: '/areas/delray-beach-tree-removal/', status: 'size', confidence: 'official',
    headline: 'An application is required to remove a palm or hardwood tree of about 4 inches or more at trunk height.',
    summary: 'The city’s landscape review says a Tree/Scrub/Vegetation Removal application is required for a tree (hardwood or palm) of 4 inches or more in diameter at breast height (4.5 feet above ground). Historic districts and beach property may also need a professional tree survey.',
    palms: 'Palms of 4 inches DBH or more are covered.',
    source: { label: 'Delray Beach landscape review FAQ', url: 'https://www.delraybeachfl.gov/government/city-departments/development-services/landscape-review/frequently-asked-questions' },
  },
  {
    id: 'boynton-beach', name: 'Boynton Beach', county: 'palm-beach', page: '/areas/boynton-beach-tree-removal/', status: 'ask', confidence: 'general',
    headline: 'Rules differ for single-family lots, commercial sites and landscape buffers; mangroves and city street trees are protected.',
    summary: 'We could not confirm Boynton Beach’s rules from the city. Reported differences: single-family lots are treated differently from commercial sites and recorded landscape buffers, street trees belong to the city, and mangroves along the waterway are protected by state law. Ask the city and your HOA.',
    source: { label: 'City of Boynton Beach', url: 'https://www.boynton-beach.org/' },
  },
  {
    id: 'west-palm-beach', name: 'West Palm Beach', county: 'palm-beach', page: '/areas/west-palm-beach-tree-removal/', status: 'ask', confidence: 'general',
    headline: 'West Palm Beach has its own tree protection rules; the county rules do not apply inside city limits.',
    summary: 'The county permit instructions apply to unincorporated land, not to property inside West Palm Beach. We could not confirm the city’s thresholds from an official source, so ask the city forester or planning office.',
    source: { label: 'City of West Palm Beach', url: 'https://www.wpb.org/' },
  },
  {
    id: 'jupiter', name: 'Jupiter', county: 'palm-beach', page: '/areas/jupiter-tree-removal/', status: 'ask', confidence: 'partial',
    headline: 'For single-family lots in HOA planned developments, the town has not required a removal permit; the association decides.',
    summary: 'A town policy memo (2011) says no vegetation removal permit is required for a tree on a single-family lot inside a planned development with an HOA, POA or COA, and no town fee; replacement follows the approved landscape plan. Street trees and common-area trees go through the association and the town. The memo is old and does not cover lots outside an HOA, so confirm with the town.',
    source: { label: 'Town of Jupiter policy memo (2011)', url: 'https://www.jupiter.fl.us/DocumentCenter/View/1939' },
  },
];

/** Used when the place is not listed: the county baseline. */
export const otherCity: Record<CountyId, { name: string; summary: string; source: { label: string; url: string } }> = {
  'miami-dade': {
    name: 'Other city in Miami-Dade County',
    summary: 'Most Miami-Dade cities with their own tree ordinance handle residential removals themselves; others fall under the county code, which exempts many yard trees at an existing single-family home (not specimen trees or natural forest communities). Ask your city and the county tree program (305-372-6574).',
    source: { label: 'Miami-Dade tree removal permit information', url: 'https://www.miamidade.gov/resources/economy/permits/documents/tree-removal.pdf' },
  },
  broward: {
    name: 'Other city in Broward County',
    summary: 'Most Broward cities have their own tree ordinance and permit; a few rely on the county Tree Preservation Program, which asks for a license for trees of about 3 inches or more with exemptions. Ask your city, or the county program (954-519-1483).',
    source: { label: 'Broward County Tree Preservation Program', url: 'https://broward.org/Environment/TreePreservation/Pages/TreeLicenses.aspx' },
  },
  'palm-beach': {
    name: 'Other city in Palm Beach County',
    summary: 'Palm Beach County has many municipalities, each with its own tree rules; in unincorporated areas the county’s code applies. HOAs often have the final say. Ask your city or the county (561-233-2400).',
    source: { label: 'Palm Beach County zoning landscape FAQ', url: 'https://discover.pbc.gov/pzb/FAQPages/Zoning-Landscape.aspx' },
  },
};

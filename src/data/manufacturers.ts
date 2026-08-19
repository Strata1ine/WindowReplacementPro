export type Manufacturer = {
  slug: string;
  name: string;
  categories: string[];
  website?: string;
  summary: string;
};

export const manufacturers: Manufacturer[] = [
  { slug: 'vinyl-pro', name: 'Vinyl-Pro', categories: ['windows'], summary: 'Vinyl replacement window systems for residential applications.' },
  { slug: 'window-city', name: 'Window City', categories: ['windows', 'entry-doors', 'patio-doors'], summary: 'Canadian window and door systems across multiple residential product lines.' },
  { slug: 'masonite', name: 'Masonite', categories: ['entry-doors'], summary: 'Exterior door systems with fiberglass, steel and decorative glass options.' },
  { slug: 'trimlite', name: 'Trimlite', categories: ['entry-doors', 'door-glass'], summary: 'Exterior doors, doorlites and related entry-system components.' },
  { slug: 'novatech', name: 'Novatech Group', categories: ['entry-doors', 'door-glass', 'patio-doors'], summary: 'Entry doors, decorative doorglass, patio doors and sealed-glass products.' },
  { slug: 'verre-select', name: 'Verre Select', categories: ['entry-doors', 'door-glass'], summary: 'Decorative door glass plus fiberglass and steel entry-door products.' },
  { slug: 'mennie-canada', name: 'Mennie Canada', categories: ['entry-doors'], summary: 'Fiberglass door slabs and components with woodgrain and smooth finishes.' },
  { slug: 'richersons', name: 'Richersons Doors', categories: ['entry-doors'], summary: 'Fiberglass entry-door collections with multiple grains, profiles and configurations.' },
  { slug: 'oceanview', name: 'Oceanview Patio Doors', categories: ['patio-doors'], summary: 'Residential sliding patio-door systems with multiple feature levels and configurations.' },
  { slug: 'vista', name: 'Vista Patio Doors', categories: ['patio-doors'], summary: 'Sliding and stacking patio-door systems, including larger contemporary openings.' }
];

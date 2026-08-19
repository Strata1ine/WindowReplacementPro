export type Location = {
  slug: string;
  name: string;
  region: string;
  intro: string;
  neighbourhoods?: string[];
};

export const locations: Location[] = [
  { slug: 'toronto', name: 'Toronto', region: 'Greater Toronto Area', intro: 'Replacement windows and exterior doors for Toronto homes, from older masonry houses to newer infill construction.', neighbourhoods: ['Etobicoke','North York','Scarborough','York','East York'] },
  { slug: 'vaughan', name: 'Vaughan', region: 'York Region', intro: 'Window and door replacement across Vaughan, with product and installation options suited to detached, townhouse and custom-home construction.', neighbourhoods: ['Woodbridge','Maple','Kleinburg','Concord'] },
  { slug: 'richmond-hill', name: 'Richmond Hill', region: 'York Region', intro: 'Energy-efficient replacement windows and doors for Richmond Hill homes.', neighbourhoods: ['Oak Ridges','Richvale','Langstaff'] },
  { slug: 'markham', name: 'Markham', region: 'York Region', intro: 'Replacement window and exterior-door options for Markham homes and neighbourhoods.', neighbourhoods: ['Unionville','Thornhill','Cornell'] },
  { slug: 'mississauga', name: 'Mississauga', region: 'Peel Region', intro: 'Window replacement, entry doors and patio doors for Mississauga homeowners.', neighbourhoods: ['Port Credit','Streetsville','Clarkson','Erin Mills'] },
  { slug: 'brampton', name: 'Brampton', region: 'Peel Region', intro: 'Replacement windows and doors for detached, semi-detached and townhouse properties in Brampton.' },
  { slug: 'oakville', name: 'Oakville', region: 'Halton Region', intro: 'Window and door replacement for Oakville homes, including premium architectural and energy-efficient options.' },
  { slug: 'burlington', name: 'Burlington', region: 'Halton Region', intro: 'Replacement windows, entry systems and patio doors for Burlington homes.' },
  { slug: 'milton', name: 'Milton', region: 'Halton Region', intro: 'Modern replacement windows and doors for Milton homes across both established and newer neighbourhoods.' },
  { slug: 'hamilton', name: 'Hamilton', region: 'Hamilton', intro: 'Replacement window and door solutions for Hamilton housing from century homes to newer construction.' },
  { slug: 'newmarket', name: 'Newmarket', region: 'York Region', intro: 'Window and exterior-door replacement for Newmarket homeowners.' },
  { slug: 'aurora', name: 'Aurora', region: 'York Region', intro: 'Replacement windows, front doors and patio doors for Aurora homes.' },
  { slug: 'caledon', name: 'Caledon', region: 'Peel Region', intro: 'Window and door replacement for Caledon properties, including larger detached and rural homes.' },
  { slug: 'ajax', name: 'Ajax', region: 'Durham Region', intro: 'Replacement windows and exterior doors for Ajax homes.' },
  { slug: 'pickering', name: 'Pickering', region: 'Durham Region', intro: 'Window and door replacement for Pickering homeowners.' },
  { slug: 'whitby', name: 'Whitby', region: 'Durham Region', intro: 'Energy-efficient replacement windows, entry doors and patio doors for Whitby homes.' },
  { slug: 'oshawa', name: 'Oshawa', region: 'Durham Region', intro: 'Replacement windows and doors for Oshawa homes across established and newer neighbourhoods.' }
];

import { publicProducts, type PublicProduct } from './public-catalog';

export type CategoryChoice = {
  id: string;
  title: string;
  description: string;
  detail: string;
  href?: string;
  visual: string;
};

export type CategoryGuidance = {
  title: string;
  description: string;
  points: string[];
};

export type CommercialCategoryPage = {
  key: 'windows' | 'entry-doors' | 'door-glass' | 'patio-doors';
  path: string;
  breadcrumb: string;
  eyebrow: string;
  title: string;
  summary: string;
  heroCaption: string;
  heroFit: 'cover' | 'contain';
  product: PublicProduct;
  serviceType: string;
  choiceEyebrow: string;
  choiceTitle: string;
  choiceBody: string;
  choices: CategoryChoice[];
  selectionEyebrow: string;
  selectionTitle: string;
  selectionBody: string;
  considerations: { title: string; description: string }[];
  guidanceEyebrow: string;
  guidanceTitle: string;
  guidanceBody: string;
  guidance: CategoryGuidance[];
  installationTitle: string;
  installationBody: string;
  installationSteps: { title: string; description: string }[];
  relatedLinks: { title: string; description: string; href: string }[];
};

const requirePublicProduct = (category: string): PublicProduct => {
  const matches = publicProducts.filter(product => product.category === category);
  if (matches.length !== 1) throw new TypeError('Expected one approved public product for ' + category);
  return matches[0];
};

const windowsProduct = requirePublicProduct('windows');
const entryDoorProduct = requirePublicProduct('entry-doors');
const doorGlassProduct = requirePublicProduct('door-glass');
const patioDoorProduct = requirePublicProduct('patio-doors');

export const commercialCategoryPages: Record<CommercialCategoryPage['key'], CommercialCategoryPage> = {  windows: {
    key: 'windows',
    path: '/windows/',
    breadcrumb: 'Replacement windows',
    eyebrow: 'Replacement windows',
    title: 'Choose the window style, glass and installation scope together.',
    summary: 'Compare operating and fixed window styles, then confirm frame, glazing, performance and installation details around the measured opening.',
    heroCaption: 'A replacement-window configuration selected around the opening and project scope.',
    heroFit: 'cover',
    product: windowsProduct,
    serviceType: 'Replacement window assessment, supply, installation and finishing',
    choiceEyebrow: 'Window styles',
    choiceTitle: 'Start with how the window should open and perform.',
    choiceBody: 'Operating style affects ventilation, cleaning, egress and sightlines. Fixed units prioritize daylight and efficiency, while projection windows change both the interior and exterior opening.',
    choices: [
      { id: 'casement', title: 'Casement', description: 'Side-hinged operation with compression sealing and full sash ventilation.', detail: 'Strong air sealing and clear opening', href: '/windows/casement-windows/', visual: 'casement' },
      { id: 'awning', title: 'Awning', description: 'Top-hinged operation that can provide controlled ventilation in compact openings.', detail: 'Useful alone or in combinations', href: '/windows/awning-windows/', visual: 'awning' },
      { id: 'hung', title: 'Hung', description: 'Vertical sash operation in single- or double-hung configurations.', detail: 'Traditional proportions and ventilation', visual: 'hung' },
      { id: 'slider', title: 'Slider', description: 'Horizontal sash operation for simple use and space-efficient ventilation.', detail: 'Single, double and end-vent layouts', visual: 'slider' },
      { id: 'picture-fixed', title: 'Picture and fixed', description: 'Non-operating glazing for daylight, views and efficient window combinations.', detail: 'No operating hardware', href: '/windows/picture-windows/', visual: 'fixed' },
      { id: 'bay-bow', title: 'Bay and bow', description: 'Projecting multi-lite assemblies that add interior depth and broader views.', detail: 'Structure and finishing require review', href: '/windows/bay-windows/', visual: 'projection' },
      { id: 'architectural', title: 'Architectural combinations', description: 'Custom groupings of fixed and operating units for larger or distinctive openings.', detail: 'Configured after site measurement', visual: 'architectural' }
    ],
    selectionEyebrow: 'Operating, fixed and performance choices',
    selectionTitle: 'The best style is the one that fits the opening and the room.',
    selectionBody: 'A window should be selected around ventilation, reach, furniture placement, exterior access, egress requirements and the desired amount of glass—not by appearance alone.',
    considerations: [
      { title: 'Glazing package', description: 'Compare insulated-glass construction, pane count, coatings, spacers and gas fill as a complete package.' },
      { title: 'Frame and configuration', description: 'Frame material, sightline, mullions, exterior profile and combination layout affect both performance and appearance.' },
      { title: 'Comfort and performance', description: 'Orientation, solar exposure, air sealing and condensation resistance should be considered for the actual room.' },
      { title: 'Operation and egress', description: 'Opening size, operating direction, hardware reach and applicable egress needs must be checked at the opening.' }
    ],
    guidanceEyebrow: 'Frame, configuration and installation',
    guidanceTitle: 'Specify the whole replacement, not only the sash style.',
    guidanceBody: 'The final quotation should connect the selected window to the existing frame, wall, trim and finish conditions.',
    guidance: [
      { title: 'Frame configuration', description: 'Confirm overall unit size, frame depth, mullions and exterior profile.', points: ['Single or combined units', 'Interior and exterior finish', 'Drainage and sill conditions'] },
      { title: 'Glass and hardware', description: 'Review the glazing package and operating components together.', points: ['Double- or triple-pane options', 'Low-emissivity coatings', 'Locks, operators and screens'] },
      { title: 'Installation method', description: 'Choose the replacement approach after the existing opening is assessed.', points: ['Existing-frame condition', 'Full-frame or insert scope', 'Air, water and finish detailing'] }
    ],
    installationTitle: 'Measurement determines the installation method.',
    installationBody: 'We assess the existing window, surrounding finishes and access before confirming the product dimensions and written installed scope.',
    installationSteps: [
      { title: 'Assess the opening', description: 'Review frame condition, water management, exterior cladding and interior trim.' },
      { title: 'Measure and configure', description: 'Confirm manufacturing dimensions, operation, glass and finish selections.' },
      { title: 'Prepare the quotation', description: 'Document product supply, removal, installation, sealing and finishing.' },
      { title: 'Install and finish', description: 'Complete the replacement, operation check, cleanup and project handoff.' }
    ],
    relatedLinks: [
      { title: 'Casement windows', description: 'Review compression-seal operation and configuration choices.', href: '/windows/casement-windows/' },
      { title: 'Picture windows', description: 'Compare fixed glazing for daylight and window combinations.', href: '/windows/picture-windows/' }
    ]
  },  'entry-doors': {
    key: 'entry-doors',
    path: '/doors/',
    breadcrumb: 'Entry doors',
    eyebrow: 'Entry-door replacement',
    title: 'Build the entrance around material, glass and configuration.',
    summary: 'Compare fiberglass and steel doors, panel styles, glass, sidelites, transoms, finishes and hardware as one measured entry system.',
    heroCaption: 'A public-neutral entry-door configuration for material, panel and glass planning.',
    heroFit: 'contain',
    product: entryDoorProduct,
    serviceType: 'Entry-door assessment, supply, installation and finishing',
    choiceEyebrow: 'Materials and design directions',
    choiceTitle: 'Start with the slab, then shape the complete entrance.',
    choiceBody: 'Material and panel design establish the door’s character. Glass, sidelites, transoms, colour and hardware should then be coordinated around daylight, privacy and the measured opening.',
    choices: [
      { id: 'fiberglass', title: 'Fiberglass', description: 'A durable slab material available in smooth and textured design directions.', detail: 'Versatile finish and panel choices', href: '/doors/fiberglass-entry-doors/', visual: 'door-panel' },
      { id: 'steel', title: 'Steel', description: 'A clean, efficient door material suited to straightforward and contemporary entrances.', detail: 'Crisp profiles and practical finishes', href: '/doors/steel-entry-doors/', visual: 'door-steel' },
      { id: 'modern', title: 'Modern and contemporary', description: 'Simple panel geometry, restrained glass and strong horizontal or vertical lines.', detail: 'Minimal profiles and selective glazing', visual: 'door-modern' },
      { id: 'traditional', title: 'Traditional', description: 'Balanced raised or recessed panels with familiar residential proportions.', detail: 'Classic panel and glass layouts', visual: 'door-traditional' },
      { id: 'craftsman', title: 'Craftsman', description: 'Strong lower panels paired with compact upper glazing and substantial trim lines.', detail: 'Distinctive upper-glass proportion', visual: 'door-craftsman' },
      { id: 'full-glass', title: 'Full-glass', description: 'Large door-glass areas for maximum daylight and a lighter visual profile.', detail: 'Privacy and exposure need review', visual: 'door-full-glass' },
      { id: 'sidelites-transoms', title: 'Sidelites and transoms', description: 'Additional glass beside or above the slab for wider and taller entrance configurations.', detail: 'Opening dimensions govern the layout', visual: 'door-system' }
    ],
    selectionEyebrow: 'Homeowner selection',
    selectionTitle: 'Every choice affects the complete entry system.',
    selectionBody: 'The slab, frame, glass and hardware should be selected together. The measured opening then determines what can be supplied and how the new system will be installed and finished.',
    considerations: [
      { title: 'Slab material and panel', description: 'Compare fiberglass or steel construction, surface texture and panel geometry.' },
      { title: 'Glass and privacy', description: 'Balance daylight, views and privacy across the door glass, sidelites and transom.' },
      { title: 'Finish and hardware', description: 'Coordinate exterior and interior colour, handleset, hinges and other visible hardware.' },
      { title: 'Size and configuration', description: 'Confirm slab size, swing, jamb depth, sidelites, transom and sill at the opening.' }
    ],
    guidanceEyebrow: 'Complete entrance specification',
    guidanceTitle: 'Treat the door, frame, glass and finish as one project.',
    guidanceBody: 'A written quotation should identify the complete system and the work needed around the existing entrance.',
    guidance: [
      { title: 'Door and frame', description: 'Confirm slab construction, panel design, jamb, sill and swing.', points: ['Fiberglass or steel slab', 'Single or wider configurations', 'In-swing, handing and threshold'] },
      { title: 'Glass and appearance', description: 'Coordinate glass size, privacy and design with the entrance.', points: ['Door glass size', 'Sidelites and transoms', 'Colour and hardware finish'] },
      { title: 'Installation scope', description: 'Define removal, preparation, setting, sealing and finish work.', points: ['Opening preparation', 'Interior trim and exterior capping', 'Adjustment, sealing and handoff'] }
    ],
    installationTitle: 'The opening sets the real door configuration.',
    installationBody: 'We assess swing, structure, jamb depth, sill and surrounding finishes before the final system is ordered.',
    installationSteps: [
      { title: 'Assess the entrance', description: 'Review opening size, structure, swing, access and surrounding finishes.' },
      { title: 'Select the system', description: 'Coordinate slab, panel, glass, sidelites, transom, colour and hardware.' },
      { title: 'Measure and quote', description: 'Prepare manufacturing dimensions and a written installed project scope.' },
      { title: 'Supply and install', description: 'Complete removal, setting, sealing, finishing, adjustment and handoff.' }
    ],
    relatedLinks: [
      { title: 'Door glass', description: 'Compare decorative, privacy, clear and modern glass directions.', href: '/doors/decorative-door-glass/' },
      { title: 'Fiberglass entry doors', description: 'Review fiberglass material and finish considerations.', href: '/doors/fiberglass-entry-doors/' }
    ]
  },  'door-glass': {
    key: 'door-glass',
    path: '/doors/decorative-door-glass/',
    breadcrumb: 'Door glass',
    eyebrow: 'Door glass',
    title: 'Balance privacy, daylight and design at the entrance.',
    summary: 'Compare door-glass styles and sizes as part of the complete entry-door configuration, then confirm the exact glass, slab and opening in the written quotation.',
    heroCaption: 'A public-neutral privacy door-glass example shown for design and configuration planning.',
    heroFit: 'contain',
    product: doorGlassProduct,
    serviceType: 'Entry-door glass selection, supply and installed entrance planning',
    choiceEyebrow: 'Glass directions',
    choiceTitle: 'Choose the level of privacy and visual detail first.',
    choiceBody: 'Door glass changes the daylight, privacy and character of the entrance. Glass size, slab layout, sidelites and transoms determine how that choice reads in the complete system.',
    choices: [
      { id: 'decorative', title: 'Decorative', description: 'Layered patterns, textures and caming used as a focal point in the entrance.', detail: 'Appearance and privacy vary by design', visual: 'glass-decorative' },
      { id: 'privacy', title: 'Privacy', description: 'Textured or obscured glass that softens views while admitting daylight.', detail: 'Compare privacy level and room exposure', visual: 'glass-privacy' },
      { id: 'clear', title: 'Clear', description: 'Unobstructed glass for maximum daylight and a simple architectural expression.', detail: 'Best where direct views are acceptable', visual: 'glass-clear' },
      { id: 'modern', title: 'Modern', description: 'Linear, geometric or minimal compositions for contemporary entrances.', detail: 'Restrained patterns and strong lines', visual: 'glass-modern' },
      { id: 'internal-blinds', title: 'Internal blinds', description: 'An integrated privacy-control option that requires compatible glass sizes and door configurations.', detail: 'Availability is configuration-specific', visual: 'glass-blinds' },
      { id: 'venting', title: 'Venting glass', description: 'Operable insert configurations that require confirmation for the selected door and opening.', detail: 'Hardware and size must be verified', visual: 'glass-venting' }
    ],
    selectionEyebrow: 'Practical tradeoffs',
    selectionTitle: 'Glass size can matter as much as the glass pattern.',
    selectionBody: 'A small upper insert, a large doorlite and a full-glass slab can use similar visual directions but create very different daylight, privacy and exterior presence.',
    considerations: [
      { title: 'Privacy', description: 'Review the actual view through the glass from inside and outside, during both day and evening conditions.' },
      { title: 'Daylight', description: 'Larger clear areas admit more light; textures, coatings and decorative layers change how that light enters.' },
      { title: 'Appearance', description: 'Coordinate the glass geometry with the slab panel, sidelites, transom, colour and hardware.' },
      { title: 'Size and layout', description: 'Confirm insert size, doorlite position and any matching sidelite or transom configuration.' }
    ],
    guidanceEyebrow: 'Glass in the complete entrance',
    guidanceTitle: 'Select the glass with the slab and opening—not in isolation.',
    guidanceBody: 'The same glass direction can look and perform differently depending on its size, surrounding panel and entrance layout.',
    guidance: [
      { title: 'Glass configuration', description: 'Choose the glass size and location within the complete slab design.', points: ['Upper, mid-size or larger doorlite', 'Matching or complementary sidelites', 'Transom alignment where applicable'] },
      { title: 'Privacy and exposure', description: 'Evaluate what the glass reveals and how much daylight the entrance needs.', points: ['Privacy direction', 'Clear versus textured areas', 'Interior and exterior sightlines'] },
      { title: 'System compatibility', description: 'Confirm the selected glass can be supplied in the measured door system.', points: ['Compatible slab and size', 'Insulated-glass construction', 'Configuration-specific options'] }
    ],
    installationTitle: 'Door glass belongs in the measured entry-door scope.',
    installationBody: 'We help select the glass, confirm the compatible slab and configuration, measure the opening and identify the exact supplied system in the quotation.',
    installationSteps: [
      { title: 'Review privacy and daylight', description: 'Identify the desired view, light level and design direction.' },
      { title: 'Coordinate the entrance', description: 'Match glass size and geometry to the slab, sidelites and transom.' },
      { title: 'Confirm compatibility', description: 'Verify the selected glass and door configuration after measurement.' },
      { title: 'Quote the complete project', description: 'Document the exact entrance system, installation and finishing scope.' }
    ],
    relatedLinks: [
      { title: 'Entry doors', description: 'Coordinate glass with slab material, panel design, finish and hardware.', href: '/doors/' },
      { title: 'Fiberglass entry doors', description: 'Review a versatile slab material for panel and glass configurations.', href: '/doors/fiberglass-entry-doors/' }
    ]
  },  'patio-doors': {
    key: 'patio-doors',
    path: '/patio-doors/',
    breadcrumb: 'Patio doors',
    eyebrow: 'Patio-door replacement',
    title: 'Choose the patio-door system around the opening and panel layout.',
    summary: 'Compare sliding and larger multi-panel configurations, then confirm frame, glazing, screen, hardware and installation details for the measured opening.',
    heroCaption: 'A multi-panel sliding patio-door configuration shown for system and layout planning.',
    heroFit: 'cover',
    product: patioDoorProduct,
    serviceType: 'Patio-door assessment, supply, installation and finishing',
    choiceEyebrow: 'System and configuration choices',
    choiceTitle: 'Start with panel movement and the available opening width.',
    choiceBody: 'The operating system and panel layout determine the usable opening, fixed-glass area and daily operation. Frame material and glazing then refine appearance and performance.',
    choices: [
      { id: 'sliding', title: 'Sliding', description: 'One or more panels move horizontally within a space-efficient frame.', detail: 'Mainstream replacement configuration', href: '/patio-doors/sliding-patio-doors/', visual: 'patio-sliding' },
      { id: 'stacking', title: 'Stacking', description: 'Multiple moving panels collect toward one side to create a wider clear opening.', detail: 'Opening and structure need review', href: '/patio-doors/stacking-patio-doors/', visual: 'patio-stacking' },
      { id: 'pvc', title: 'PVC', description: 'A practical insulated frame direction common in residential replacement work.', detail: 'Profile and reinforcement vary', visual: 'patio-pvc' },
      { id: 'aluminum', title: 'Aluminum', description: 'A slimmer-frame direction suited to contemporary and larger-format designs.', detail: 'Thermal design must be compared', visual: 'patio-aluminum' },
      { id: 'hybrid', title: 'Hybrid', description: 'A mixed-material frame direction balancing interior performance and exterior durability.', detail: 'Construction is system-specific', visual: 'patio-hybrid' },
      { id: 'multi-panel', title: 'Oversized and multi-panel', description: 'Three- and four-panel layouts for wider openings and broader glass areas.', detail: 'Not every system supports every layout', visual: 'patio-multi' }
    ],
    selectionEyebrow: 'Layout and system decisions',
    selectionTitle: 'Panel count does not tell the whole story.',
    selectionBody: 'Opening direction, fixed-panel location, usable passage width and screen operation should be understood before the frame and glass package are selected.',
    considerations: [
      { title: 'Panel layout', description: 'Confirm the number of panels, which panels operate and where they stack or meet.' },
      { title: 'Opening width', description: 'Compare overall unit size with the actual clear passage and available wall structure.' },
      { title: 'Frame and glazing', description: 'Review frame material, sightlines, insulated glass and performance as one system.' },
      { title: 'Screen and hardware', description: 'Confirm screen type, handles, locks, rollers and threshold around everyday use.' }
    ],
    guidanceEyebrow: 'System specification',
    guidanceTitle: 'Match the panel system to the opening and installation conditions.',
    guidanceBody: 'Larger glass areas and wider systems place different demands on structure, handling, sill support and water management.',
    guidance: [
      { title: 'Panel configuration', description: 'Define the layout, operating direction and usable opening.', points: ['Two-, three- or four-panel direction', 'Sliding or stacking operation', 'Fixed and operating panel positions'] },
      { title: 'Frame and components', description: 'Compare the complete system rather than one material label.', points: ['PVC, aluminum or hybrid direction', 'Glazing and frame sightlines', 'Screen, rollers, locks and handles'] },
      { title: 'Installation conditions', description: 'Assess the opening before committing to a larger or heavier system.', points: ['Structure and sill support', 'Access and material handling', 'Water, air and finish detailing'] }
    ],
    installationTitle: 'Wider systems require precise planning before ordering.',
    installationBody: 'We assess the opening, structure, sill and access before confirming the panel layout, manufacturing dimensions and written installation scope.',
    installationSteps: [
      { title: 'Assess the opening', description: 'Review width, height, structure, sill, drainage, access and surrounding finishes.' },
      { title: 'Configure the system', description: 'Confirm panel layout, operation, frame, glass, screen and hardware.' },
      { title: 'Measure and quote', description: 'Document exact dimensions, supplied system and installed project scope.' },
      { title: 'Install and commission', description: 'Complete setting, sealing, adjustment, finishing and operation checks.' }
    ],
    relatedLinks: [
      { title: 'Sliding patio doors', description: 'Review mainstream horizontal sliding configurations.', href: '/patio-doors/sliding-patio-doors/' },
      { title: 'Stacking patio doors', description: 'Understand the planning needs for wider multi-panel openings.', href: '/patio-doors/stacking-patio-doors/' }
    ]
  }
};
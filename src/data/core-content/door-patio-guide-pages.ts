import type { CoreContentPage } from '../core-content';

export const doorPatioGuidePages: CoreContentPage[] = [
  {
    path: '/guides/fiberglass-vs-steel-entry-doors/', kind: 'guide', cluster: 'doors', eyebrow: 'Entry-door material comparison',
    title: 'Fiberglass vs steel entry doors.',
    metaTitle: 'Fiberglass vs Steel Entry Doors | Window Replacement Pro',
    metaDescription: 'Compare fiberglass and steel entry doors by appearance, grain, dent resistance, finish, maintenance, glass configurations, construction and project considerations.',
    lead: 'Fiberglass and steel are both established exterior-door materials. The useful comparison is not which label is universally better, but how the slab surface, construction, finish, glass, frame and opening fit the project.',
    intro: [
      'Fiberglass slabs can be smooth or textured to suggest woodgrain and are available across many panel directions. Steel slabs commonly provide clean smooth surfaces and crisp profiles. Exact skins, cores, edge construction and reinforcement vary by the selected system.',
      'Durability depends on exposure, finish, use and maintenance. A material comparison cannot replace inspection of the threshold, jamb, weatherseals and opening, which often determine whether the finished entrance operates and seals properly.'
    ],
    highlights: ['Representative neutral imagery for both materials', 'Appearance and damage resistance compared', 'Glass and configuration availability considered', 'Exact construction confirmed in quotation'],
    breadcrumbs: [{ label: 'Guides', href: '/guides/' }],
    sections: [
      {
        id: 'comparison', eyebrow: 'Side by side', title: 'Material affects surface, finish and damage response.',
        paragraphs: ['The table describes common directions. A specific slab can differ, so use product documentation for construction, finish requirements, dimensions and warranty conditions.'],
        table: { caption: 'Fiberglass and steel entry-door comparison', columns: ['Consideration', 'Fiberglass', 'Steel'], rows: [
          ['Appearance', 'Smooth or textured skins with a wide range of panel and woodgrain directions.', 'Commonly smooth with clean panel or flush directions; exact embossing varies.'],
          ['Texture and grain', 'Woodgrain textures are a common option where a stained or wood-like direction is desired.', 'Usually selected for a smooth painted surface rather than woodgrain texture.'],
          ['Dents and impact', 'Surface response varies; fiberglass does not dent like sheet steel but can still crack or be damaged.', 'Steel skins can dent from impact; repair and finish response depend on severity.'],
          ['Finish choices', 'Painted and, for suitable textured products, stain-like finish directions may be available.', 'Typically factory- or site-painted in compatible coating systems.'],
          ['Maintenance', 'Inspect finish, edges, seals, hardware and exposure; refinish as the documented system requires.', 'Protect coating from damage and address exposed steel or corrosion promptly where it occurs.'],
          ['Glass and configurations', 'Available across many panel, glass, sidelite and transom directions.', 'Also available with glass and entrance configurations, subject to the exact system.'],
          ['Weight and construction', 'Core, skin, stiles and reinforcement vary; do not infer weight from material name alone.', 'Steel skin and internal construction vary; compare the complete prehung system.']
        ] }
      },
      {
        id: 'appearance', eyebrow: 'Design direction', title: 'Start with the entrance you need, then select the material.',
        paragraphs: [
          'A traditional grained panel, smooth modern flush slab and glass-heavy entrance have different visual priorities. Fiberglass can support both smooth and textured directions; steel is often useful for restrained painted designs. Panel depth, glass proportion and hardware usually matter more to appearance than the material word alone.',
          'Colour exposure matters. Dark finishes in strong sun, storm-door use and sheltered versus exposed entrances can affect manufacturer finish requirements. Those conditions should be reviewed for the exact quoted system.'
        ],
        cards: [
          { title: 'Fiberglass direction', text: 'Consider when textured grain, varied panel geometry or a stain-like appearance is important, subject to available finish systems.' },
          { title: 'Steel direction', text: 'Consider for clean painted surfaces, straightforward panels or flush contemporary designs where the exact construction fits.' },
          { title: 'Either material', text: 'Coordinate slab, frame, threshold, glass, sidelites, transom, hardware and finish as one entrance.' }
        ]
      },
      {
        id: 'durability', eyebrow: 'Use and exposure', title: 'Damage resistance and maintenance depend on conditions.',
        paragraphs: [
          'Fiberglass avoids the classic dent behaviour of thin sheet metal, but impact can still mark, chip or crack a surface. Steel can resist ordinary use well while remaining susceptible to dents and corrosion where protective coatings are breached. Neither material is maintenance-free.',
          'Water at the sill, failed perimeter seals, poorly adjusted hardware and finish breakdown can affect either system. Regular inspection should focus on drainage, threshold support, weatherseals, hinges, locking, finish and bottom-edge condition.'
        ],
        callout: { title: 'Compare complete systems', text: 'Ask for slab construction, finish, frame, threshold, glass, hardware, performance documentation and warranty—not only “fiberglass” or “steel.”' }
      },
      {
        id: 'project-fit', eyebrow: 'Selection checklist', title: 'Opening, glass and finish narrow the decision.',
        paragraphs: [
          'Confirm slab size, swing, jamb depth, sill, glass amount, privacy, sidelites, transom and hardware before choosing from surface appearance. Existing floor height, exterior cladding and interior trim affect installation regardless of material.',
          'The public catalogue currently contains approved fiberglass families. Steel remains available as an educational category and quotation direction, but no steel product-detail family is published until its evidence and public hero gate are complete.'
        ],
        cards: [
          { title: 'Compare fiberglass directions', text: 'Review smooth, oak-grain, mahogany-grain, Craftsman and glass configurations in the approved catalogue.' },
          { title: 'Review steel as a category', text: 'Use the steel entry-door page for material planning without implying a specific unpublished product.' },
          { title: 'Confirm in writing', text: 'The quotation identifies exact slab, model, finish, glass, hardware, frame and installation scope.' }
        ]
      }
    ],
    productReferences: ['WRP-D002', 'WRP-D003', 'WRP-D004', 'WRP-D005'],
    relatedLinks: [
      { title: 'Fiberglass entry doors', description: 'Review the approved material category and public configurations.', href: '/doors/fiberglass-entry-doors/' },
      { title: 'Steel entry doors', description: 'Review the steel material direction without a fabricated product family.', href: '/doors/steel-entry-doors/' },
      { title: 'Entry-door replacement cost', description: 'See how material, glass and finish enter a quotation.', href: '/entry-door-replacement-cost/' },
      { title: 'Door glass', description: 'Compare privacy and decorative glass directions.', href: '/doors/decorative-door-glass/' }
    ],
    heroReference: 'WRP-D003', visualReferences: ['WRP-D002', 'WRP-D004', 'WRP-D005'], technicalMediaKeys: ['steel-entry-door-example'],
    visualGap: 'The steel image is a reviewed neutral derivative used only as a representative material example; a steel public product page remains withheld.'
  },
  {
    path: '/guides/patio-door-types/', kind: 'guide', cluster: 'patio', eyebrow: 'Panel and frame systems',
    title: 'Patio door types and configurations.',
    metaTitle: 'Patio Door Types and Systems | Window Replacement Pro',
    metaDescription: 'Compare two-, three- and four-panel patio doors, PVC, aluminum, hybrid, stacking and oversized systems by opening width, panel movement and practical use.',
    lead: 'Patio door selection starts with the measured opening and desired panel movement. Panel count determines where fixed and operating glass sits; frame material then affects profile, finish and the available system direction.',
    intro: [
      'Sliding patio doors keep panels within the frame footprint. Two-panel systems are common, while three- and four-panel layouts distribute wider openings across more glass and meeting rails. Stacking systems collect several moving panels to create a wider clear opening but require project-specific support and configuration.',
      'PVC, aluminum and hybrid describe frame-material directions, not panel counts. A two-panel or multi-panel system may be available in more than one material depending on the exact product. Compare the complete configuration rather than treating the labels as separate layers of choice.'
    ],
    highlights: ['Visual examples across all six public patio families', 'Panel movement and clear opening explained', 'PVC, aluminum and hybrid compared', 'Stacking and oversized systems held to project-specific review'],
    breadcrumbs: [{ label: 'Guides', href: '/guides/' }],
    sections: [
      {
        id: 'panel-layouts', eyebrow: 'Sliding configurations', title: 'Panel count changes the opening pattern.',
        paragraphs: [
          'A two-panel system generally pairs one operating and one fixed panel, though handed operation varies. Three-panel systems can use different fixed and moving arrangements. Four-panel layouts often place operating panels at the centre or ends, depending on the system.',
          'Overall frame width does not equal clear passage. Meeting rails, fixed panels and the amount each panel travels determine the usable opening. Furniture placement, traffic flow, exterior steps and screen operation should be reviewed with the plan view.'
        ],
        cards: [
          { title: 'Two panel', text: 'Compact mainstream sliding direction with one principal meeting rail; confirm handing and clear opening.' },
          { title: 'Three panel', text: 'Wider glass composition with layout-specific movement; confirm which panel operates and where it parks.' },
          { title: 'Four panel', text: 'Large symmetrical or end-operating possibilities with more rails, rollers and handling requirements.' },
          { title: 'Multi-panel sliding', text: 'A broader family covering three- and four-panel arrangements where the exact layout follows opening and system.' }
        ]
      },
      {
        id: 'materials', eyebrow: 'Frame directions', title: 'PVC, aluminum and hybrid systems create different profiles.',
        paragraphs: [
          'PVC is common in residential replacement and can provide insulated frame construction with practical finish directions. Aluminum can support slimmer contemporary sightlines and larger-format systems where the exact thermal design and exposure are suitable. Hybrid systems combine materials or interior/exterior directions to balance profile, finish and performance goals.',
          'Material alone does not establish performance. Review whole-system glazing, frame design, sill, air and water ratings where applicable, reinforcement, panel size and installation.'
        ],
        table: { caption: 'Patio-door frame directions', columns: ['Direction', 'Typical reason to consider', 'What to verify'], rows: [
          ['PVC', 'Residential replacement, insulated profiles and familiar finish options.', 'Profile width, reinforcement, colour, sill, panel size and ratings.'],
          ['Aluminum', 'Slimmer visual profiles and contemporary or larger-format direction.', 'Thermal design, exposure, finish, glass package, size and support.'],
          ['Hybrid', 'Different material or finish priorities at interior and exterior.', 'How materials are combined, profile, finish, drainage and performance.'],
          ['Slim-frame aluminum', 'Reduced sightline where a compatible measured system supports it.', 'Panel limits, glass weight, hardware, sill and whole-system values.']
        ] }
      },
      {
        id: 'stacking', eyebrow: 'Larger openings', title: 'Stacking and oversized systems require more than a category label.',
        paragraphs: [
          'Stacking panels move and collect toward one or both sides, potentially creating a larger opening than a conventional slider. Panel parking area, track count, sill, screen strategy, structural support and weather exposure all become part of the design.',
          'Oversized systems involve heavy glass, handling, deflection, structural opening conditions and site access. Current reviewed evidence does not support a standalone public stacking or oversized product family, so these remain project-specific educational directions rather than thin pages.'
        ],
        cards: [
          { title: 'Panel parking', text: 'Identify where moving panels collect and how much clear passage remains.' },
          { title: 'Structure and sill', text: 'Confirm header, side support, threshold, floor transition and drainage for the measured opening.' },
          { title: 'Glass and hardware', text: 'Panel weight affects rollers, locks, handles and available glazing packages.' },
          { title: 'Access and installation', text: 'Large units may require equipment, additional labour and coordinated interior/exterior finishing.' }
        ]
      },
      {
        id: 'selection', eyebrow: 'Buying decision', title: 'Compare configuration before colour and hardware.',
        paragraphs: [
          'Start with overall opening, desired passage, fixed view area and traffic flow. Then choose a system direction and frame material. Glazing, internal blinds where available, screen, handle, lock, colour and sill details follow from that compatible base.',
          'The written quotation should include the exact panel plan, size, material, glazing, screen, hardware, sill, installation and finish scope. Do not assume a lifestyle image establishes the quoted layout.'
        ],
        callout: { title: 'Visuals are representative, not promises', text: 'Every image on this guide uses a neutral reviewed derivative. Final panel layout, frame, colour and options are identified for the measured system in writing.' }
      }
    ],
    productReferences: ['WRP-P002', 'WRP-P001', 'WRP-P003', 'WRP-P004', 'WRP-P005', 'WRP-P006'],
    relatedLinks: [
      { title: 'Patio doors', description: 'Browse all approved public patio configurations.', href: '/patio-doors/' },
      { title: 'Patio-door replacement cost', description: 'See how panel count and material affect quotation scope.', href: '/patio-door-replacement-cost/' },
      { title: 'Sliding patio doors', description: 'Review the broader sliding category.', href: '/patio-doors/sliding-patio-doors/' },
      { title: 'Stacking patio doors', description: 'Review project-specific stacking considerations.', href: '/patio-doors/stacking-patio-doors/' }
    ],
    heroReference: 'WRP-P001', visualReferences: ['WRP-P002', 'WRP-P003', 'WRP-P004', 'WRP-P005', 'WRP-P006'], technicalMediaKeys: ['patio-panel-configuration', 'patio-lock-detail'],
    visualGap: 'No reviewed public-safe stacking cutaway or full multi-track plan is available; public visuals are limited to verified sliding systems and neutral shared configuration evidence.'
  }
];

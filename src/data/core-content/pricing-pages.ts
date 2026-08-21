import type { CoreContentPage } from '../core-content';

export const pricingPages: CoreContentPage[] = [
  {
    path: '/window-replacement-cost/', kind: 'service', cluster: 'windows', eyebrow: 'Installed-project pricing',
    title: 'What determines window replacement cost.',
    metaTitle: 'Window Replacement Cost Factors | Window Replacement Pro',
    metaDescription: 'Understand how window size, style, glazing, installation method, access, finishing and opening conditions shape a complete window replacement quotation.',
    lead: 'A reliable window replacement price is assembled from the specified product and the work required at each measured opening. The repository does not contain an approved public price schedule, so this page explains the cost structure without publishing invented ranges.',
    intro: [
      'Two windows with similar visible dimensions can have different installed costs because one opens, one is fixed, one uses a different glazing package, or one requires more extensive frame and finish work. A meaningful estimate therefore needs more than a unit count.',
      'The practical way to compare quotations is to separate product configuration, installation method, finishing and project conditions. When those elements are written clearly, a lower number can be evaluated for missing scope rather than assumed to represent the same work.'
    ],
    highlights: ['No fabricated public price ranges', 'Product and installation priced together', 'Opening-by-opening scope matters', 'Written inclusions make quotations comparable'],
    breadcrumbs: [],
    sections: [
      {
        id: 'product-factors', eyebrow: 'Product configuration', title: 'The manufactured window establishes the first part of cost.',
        paragraphs: [
          'Operating sashes need hardware, seals and frame profiles that fixed units do not. Larger units use more material and glass, and joined assemblies add mullions and handling considerations. Non-standard shapes or combinations require project-specific manufacturing review.',
          'Glazing choices can change construction, weight and performance. Double or triple panes, low-emissivity coatings, gas fills, specialty glass, grids and colour selections should be quoted for the exact size and operating style.'
        ],
        cards: [
          { title: 'Size and configuration', text: 'Overall frame dimensions, single versus combined units, fixed and operating sections, and custom shapes.' },
          { title: 'Operating style', text: 'Casement, awning, hung and slider hardware differ from picture or fixed construction.' },
          { title: 'Glazing package', text: 'Pane count, coatings, gas fills, spacer, safety or privacy glass and grid choices.' },
          { title: 'Frame and finish', text: 'Interior and exterior colour, profile, hardware finish, screens and factory-applied options.' }
        ]
      },
      {
        id: 'installation-factors', eyebrow: 'Work at the opening', title: 'Installation and finishing can be as important as the window itself.',
        paragraphs: [
          'Full-frame replacement generally includes more removal, perimeter access and finish work than a suitable insert installation. Interior jamb extensions, casing, exterior brickmould or capping can add material and labour. Upper-floor access, large glass and restricted work areas affect handling.',
          'Structural changes are separate from ordinary replacement. Enlarging, reducing or reshaping an opening can involve framing, permits, engineering, masonry, cladding and interior repair. Those items should not be hidden inside a generic window allowance.'
        ],
        cards: [
          { title: 'Replacement method', text: 'Full-frame or retrofit scope, retained components, opening preparation, insulation and sealing.' },
          { title: 'Interior finish', text: 'Jamb depth, extensions, casing, drywall or other returns, paint exclusions and adjacent surfaces.' },
          { title: 'Exterior finish', text: 'Brickmould, capping, siding or masonry returns, water management and finish sealants.' },
          { title: 'Access and handling', text: 'Upper floors, large or heavy units, limited exterior access, protection and equipment requirements.' },
          { title: 'Opening condition', text: 'Visible deterioration, alignment, prior leakage and the process for concealed conditions.' },
          { title: 'Removal and disposal', text: 'Old units, glass, trim and installation debris, plus site protection and cleanup.' }
        ]
      },
      {
        id: 'project-factors', eyebrow: 'Whole-project effects', title: 'Quantity changes efficiency, not the need to specify each opening.',
        paragraphs: [
          'A larger project can spread mobilization, delivery and setup across more units, but each opening still needs a measured configuration. Repeated standard windows may be efficient; a mixed project of bays, large fixed glass and upper-floor units can remain complex.',
          'Scheduling, occupied-room access and phased work can also affect logistics. The quotation should distinguish assumptions that apply to the whole project from options or repairs tied to one opening.'
        ],
        table: { caption: 'Window replacement quotation structure', columns: ['Quotation area', 'What should be identified'], rows: [
          ['Product', 'Window style, configuration, size, glazing, colour, hardware, screens and major options.'],
          ['Installation', 'Full-frame or retrofit method, removal boundary, fastening, insulation, air sealing and exterior water management.'],
          ['Finishing', 'Interior jamb and trim, exterior brickmould or capping, sealants, excluded paint or wall repairs.'],
          ['Project conditions', 'Access, floor level, protection, disposal, delivery and scheduling assumptions.'],
          ['Allowances and exclusions', 'Concealed deterioration, structural work, hazardous materials or repairs not confirmed before removal.'],
          ['Documentation', 'Exact supplied system, performance information, warranty documents and change-approval process.']
        ] }
      },
      {
        id: 'compare-quotes', eyebrow: 'Buying guidance', title: 'Compare quotations by scope before comparing totals.',
        paragraphs: [
          'Check that the same openings, installation methods, glazing packages and finishes are included. A quotation that omits jamb work, capping, disposal or concealed-condition handling is not necessarily equivalent to one that lists them.',
          'Ask for revisions when a line is unclear. A complete written quotation protects against assumptions about what “standard installation” includes and provides the reference for final measurement, ordering and handoff.'
        ],
        callout: { title: 'No public price range has been approved', text: 'This page intentionally contains no dollar figures. Installed pricing will be added only when a current, public-use business model has been identified and reviewed.' }
      }
    ],
    productReferences: ['WRP-W001', 'WRP-W004', 'WRP-W006', 'WRP-W008'],
    relatedLinks: [
      { title: 'Complete window replacement', description: 'See how product and installation decisions fit together.', href: '/window-replacement/' },
      { title: 'Window installation', description: 'Understand the work included at the opening.', href: '/window-installation/' },
      { title: 'Full-frame vs retrofit', description: 'Compare how installation method changes scope.', href: '/guides/full-frame-vs-retrofit-windows/' },
      { title: 'Double vs triple pane', description: 'Review the glazing tradeoffs that can affect cost.', href: '/guides/double-vs-triple-pane-windows/' }
    ],
    heroReference: 'WRP-W007', visualReferences: ['WRP-W001', 'WRP-W006', 'WRP-W008'], technicalMediaKeys: ['window-double-hung-profile']
  },
  {
    path: '/entry-door-replacement-cost/', kind: 'service', cluster: 'doors', eyebrow: 'Installed entrance pricing',
    title: 'What determines entry door replacement cost.',
    metaTitle: 'Entry Door Replacement Cost Factors | Window Replacement Pro',
    metaDescription: 'Understand how door material, glass, sidelites, transoms, hardware, frame, threshold, finish, opening condition and installation shape an entry-door quote.',
    lead: 'An entry door quotation covers a complete entrance system, not only a slab. Material, panel design, glass, frame, sill, hardware and finishing must all be coordinated with the measured opening. No unapproved dollar ranges are published here.',
    intro: [
      'A straightforward single door with limited glass has a different product and labour scope from a wide entrance with sidelites, a transom or two operating slabs. Even when the opening size stays the same, decorative glass, finish, hardware and jamb choices can change the supplied system.',
      'Installation pricing also depends on what surrounds the door. Interior casing, exterior trim, cladding, sill support, floor height, swing and opening condition should be assessed before final order.'
    ],
    highlights: ['Price the complete prehung system', 'Glass and entrance configuration matter', 'Hardware and finishes need exact scope', 'Opening condition drives installation work'],
    breadcrumbs: [],
    sections: [
      {
        id: 'door-system', eyebrow: 'Product factors', title: 'The slab is only one component of the entrance.',
        paragraphs: [
          'Fiberglass and steel slabs have different surface, panel and finish directions. Smooth, woodgrain, flush and traditional panel designs may also carry different glass and size possibilities. The exact construction should be identified in the quotation rather than reduced to a material label.',
          'Door glass changes daylight, privacy, appearance and cost. Larger inserts, decorative designs, sidelites and transoms add insulated-glass components and can change frame construction and handling.'
        ],
        cards: [
          { title: 'Slab and material', text: 'Fiberglass or steel construction, smooth or textured surface, panel design, size and swing.' },
          { title: 'Door glass', text: 'Insert size, clear or privacy direction, decorative construction and safety-glass requirements.' },
          { title: 'Entrance configuration', text: 'Single or double doors, one or two sidelites, transom and the framing needed around them.' },
          { title: 'Frame and threshold', text: 'Jamb material and depth, sill, weatherseals, brickmould and compatible finish components.' }
        ]
      },
      {
        id: 'finish-hardware', eyebrow: 'Visible choices', title: 'Hardware and finish selections belong in the product scope.',
        paragraphs: [
          'Handlesets, multi-point or standard locking where available, hinges, closers and accessory hardware should be identified by function and finish. Existing hardware is not automatically reusable or compatible with a new slab and frame.',
          'Factory finish, site finish and unfinished surfaces carry different labour and maintenance implications. Interior and exterior colours may differ, and textured slabs can require a finish system suited to the selected surface.'
        ],
        cards: [
          { title: 'Locking and handles', text: 'Handleset type, lock preparation, keying, multipoint availability and visible finish.' },
          { title: 'Hinges and swing', text: 'Handing, in-swing direction, hinge finish and door-clearance implications.' },
          { title: 'Factory or site finish', text: 'Which faces and edges arrive finished and what painting or staining is excluded.' },
          { title: 'Screen and storm components', text: 'Only where compatible and explicitly included; do not assume an existing accessory transfers.' }
        ]
      },
      {
        id: 'installation', eyebrow: 'Work around the entrance', title: 'Opening and finish conditions shape the installation price.',
        paragraphs: [
          'Removal exposes the sill, framing and perimeter of a frequently used exterior opening. The new frame must be supported, aligned, fastened, insulated, air sealed and connected to exterior water management. Threshold height and floor transitions need particular attention.',
          'Wide systems, transoms, masonry interfaces, deteriorated sills and altered openings require more handling or repair. Structural enlargement is not ordinary replacement and should be separated in the quotation.'
        ],
        table: { caption: 'Entry-door quotation structure', columns: ['Quotation area', 'What should be identified'], rows: [
          ['Door system', 'Slab material, panel, size, frame, threshold, weatherseals, swing and configuration.'],
          ['Glass', 'Design direction, size, privacy, sidelites, transom and matching requirements.'],
          ['Hardware', 'Handleset, locks, hinges, finish, included preparation and accessories.'],
          ['Finishes', 'Interior and exterior colours, factory or site finish, casing, brickmould or capping.'],
          ['Installation', 'Removal, opening preparation, setting, insulation, sealing, adjustment and disposal.'],
          ['Conditions and exclusions', 'Sill repair, structural work, floor transitions, wiring, alarms or concealed deterioration.']
        ] }
      },
      {
        id: 'quote', eyebrow: 'Compare complete systems', title: 'A lower slab price does not describe the installed entrance.',
        paragraphs: [
          'Compare quotations with the same door size, material, glass, configuration, hardware and finish. Confirm whether casing, exterior trim, disposal and touch-up work are included. Ask how the exact model and warranty will be documented.',
          'If a desired steel, double-door or transom configuration is not represented in the public catalogue, it can still be discussed during quotation where internal evidence and measured compatibility support it. A public page is not created solely to imply availability.'
        ],
        callout: { title: 'No wholesale or margin data is exposed', text: 'This page explains homeowner-facing cost factors only. Trade pricing, discounts, margins and unapproved public dollar ranges are not used or exposed.' }
      }
    ],
    productReferences: ['WRP-D002', 'WRP-D003', 'WRP-D005', 'WRP-D007'],
    relatedLinks: [
      { title: 'Entry doors', description: 'Browse approved public door configurations.', href: '/doors/' },
      { title: 'Fiberglass vs steel', description: 'Compare material directions before configuring the entrance.', href: '/guides/fiberglass-vs-steel-entry-doors/' },
      { title: 'Door glass', description: 'Compare privacy, daylight and decorative directions.', href: '/doors/decorative-door-glass/' },
      { title: 'Door-glass products', description: 'Browse approved public glass families.', href: '/doors/decorative-door-glass/#catalogue' }
    ],
    heroReference: 'WRP-D005', visualReferences: ['WRP-D002', 'WRP-D003', 'WRP-D007'], technicalMediaKeys: [],
    visualGap: 'A public-safe entrance-system cost diagram is not available; verified product renders are used without implying an exact quoted system.'
  },
  {
    path: '/patio-door-replacement-cost/', kind: 'service', cluster: 'patio', eyebrow: 'Installed patio-system pricing',
    title: 'What determines patio door replacement cost.',
    metaTitle: 'Patio Door Replacement Cost Factors | Window Replacement Pro',
    metaDescription: 'Understand how panel count, frame material, glazing, hardware, screens, opening width, structural alterations, removal and finishing shape a patio-door quote.',
    lead: 'Patio door pricing follows panel layout, frame material, glazing, hardware and the measured work at the opening. This guide explains the quotation structure without inventing dollar ranges or exposing confidential trade pricing.',
    intro: [
      'A two-panel sliding replacement and a wider multi-panel system do not have the same glass area, frame, hardware or handling needs. Slim aluminum, PVC and hybrid directions can also differ in profile, finish and performance options.',
      'The opening sets the installation scope. Width, sill support, floor level, exterior access, existing water management and any structural change must be considered before the complete project can be priced.'
    ],
    highlights: ['Panel layout drives system size and hardware', 'Material and glazing affect product scope', 'Screen and sill details must be included', 'Structural changes are quoted separately'],
    breadcrumbs: [],
    sections: [
      {
        id: 'system-factors', eyebrow: 'Product system', title: 'Panel count and frame construction establish the main configuration.',
        paragraphs: [
          'Two-, three- and four-panel sliding systems distribute fixed and operating panels differently. Multi-panel and stacking directions can create wider openings but introduce additional tracks, rollers, locks and structural considerations. The exact clear opening should be reviewed rather than inferred from overall width.',
          'PVC, aluminum and hybrid frames have different profiles and finish directions. The selected material must be considered with the opening size, exposure, glazing and desired sightlines.'
        ],
        cards: [
          { title: 'Panel count and movement', text: 'Fixed and operating panel layout, direction of travel, meeting rails and usable clear opening.' },
          { title: 'Frame material', text: 'PVC, aluminum or hybrid construction, reinforcement, profile and interior/exterior finish.' },
          { title: 'Opening width', text: 'Overall frame dimensions, mullions, handling and whether the existing structure can remain unchanged.' },
          { title: 'Stacking or oversized scope', text: 'Additional panels, tracks and weight plus project-specific structural and water-management review.' }
        ]
      },
      {
        id: 'options', eyebrow: 'Glazing and operation', title: 'Glass, hardware and screens complete the daily-use system.',
        paragraphs: [
          'Large glass areas make glazing important for thermal performance, solar gain, safety and weight. Pane count, coatings, gas fills and specialty options such as internal blinds must be confirmed for the selected system and size.',
          'Rollers, handles, locks, screens and sill design affect daily operation. Hardware finish and screen type should appear in the quotation rather than be assumed from a display image.'
        ],
        cards: [
          { title: 'Glazing', text: 'Pane count, coatings, gas fill, safety requirements, internal blinds where available and whole-system performance.' },
          { title: 'Rollers and locks', text: 'Operating hardware, locking points, handle style and finish appropriate to panel size and system.' },
          { title: 'Screen', text: 'Included panel count, frame, mesh, track and whether a retractable or specialty screen is part of the scope.' },
          { title: 'Sill and drainage', text: 'Threshold profile, support, drainage and transition to interior and exterior surfaces.' }
        ]
      },
      {
        id: 'installation', eyebrow: 'Opening work', title: 'Removal and finishing depend on the existing wall and sill.',
        paragraphs: [
          'The old system must be removed without assuming the sill or perimeter is ready for reuse. The installer reviews support, level, water management and visible deterioration before setting the new frame. Large units may require additional labour, access and lifting planning.',
          'Changing the opening width or height is structural work, not a standard patio-door replacement allowance. It can involve engineering, permits, framing, masonry or cladding, electrical relocation and extensive interior finishing.'
        ],
        table: { caption: 'Patio-door quotation structure', columns: ['Quotation area', 'What should be identified'], rows: [
          ['System', 'Panel count, layout, frame material, size, colour, sill and operating direction.'],
          ['Glass and options', 'Pane count, coatings, safety glass, internal blinds where supported and grids.'],
          ['Hardware and screen', 'Handles, locks, rollers, finish, screen type and included panels.'],
          ['Installation', 'Removal, sill and opening preparation, support, fastening, insulation, sealing and adjustment.'],
          ['Finishing', 'Interior trim, floor transition, exterior capping or cladding interface and excluded repairs.'],
          ['Project conditions', 'Access, handling, disposal, structural changes and concealed deterioration process.']
        ] }
      },
      {
        id: 'compare', eyebrow: 'Compare complete quotations', title: 'Match panel layout and installation scope before comparing totals.',
        paragraphs: [
          'Confirm the same system width, panel operation, frame material, glazing, screen and hardware are included. Verify whether interior trim, exterior finish, disposal and sill work are part of the price.',
          'For stacking, oversized or altered openings, expect project-specific assessment. Those configurations should not be represented by a generic price or a thin public page merely because a source image exists.'
        ],
        callout: { title: 'No approved public price schedule is available', text: 'Dollar ranges are intentionally withheld. Current installed pricing is prepared from the measured system and written scope.' }
      }
    ],
    productReferences: ['WRP-P002', 'WRP-P001', 'WRP-P003', 'WRP-P004'],
    relatedLinks: [
      { title: 'Patio doors', description: 'Browse approved public patio systems.', href: '/patio-doors/' },
      { title: 'Patio door types', description: 'Compare panel layouts and frame-material directions.', href: '/guides/patio-door-types/' },
      { title: 'Multi-panel sliding patio door', description: 'Review a public multi-panel configuration.', href: '/products/patio-doors/multi-panel-sliding-patio-door/' },
      { title: 'Slim-frame aluminum patio door', description: 'Review a public aluminum configuration.', href: '/products/patio-doors/slim-frame-aluminum-patio-door/' }
    ],
    heroReference: 'WRP-P004', visualReferences: ['WRP-P001', 'WRP-P002', 'WRP-P003'], technicalMediaKeys: ['patio-panel-configuration', 'patio-lock-detail'],
    visualGap: 'No approved public-safe stacking-system cutaway is available; stacking remains educational text rather than an implied product offer.'
  }
];

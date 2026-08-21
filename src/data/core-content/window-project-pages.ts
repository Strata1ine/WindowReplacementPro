import type { CoreContentPage } from '../core-content';

export const windowProjectPages: CoreContentPage[] = [
  {
    path: '/window-replacement/', kind: 'service', cluster: 'windows', eyebrow: 'Complete replacement project',
    title: 'Window replacement, from opening assessment to finished installation.',
    metaTitle: 'Window Replacement in Ontario | Window Replacement Pro',
    metaDescription: 'Understand the complete window replacement process, including product selection, measurement, glazing, installation methods, finishing and written quotation scope.',
    lead: 'Replacing a house window is a coordinated product-and-installation project. The useful decisions begin with the existing opening, continue through window style and glass selection, and end with a written scope that explains exactly what will be removed, supplied, sealed and finished.',
    intro: [
      'Replacement makes sense when a window no longer operates reliably, allows persistent air or water leakage, has deteriorated frames or recurring sealed-unit failures, or no longer meets the room’s practical needs. The decision should follow an assessment of the opening rather than age alone.',
      'The phrase “window replacement” can describe several scopes. Sometimes the complete old frame is removed to expose the rough opening. In other projects, a new unit is installed within a sound existing frame. Glass-only or hardware repairs are different again.'
    ],
    highlights: ['Assess the existing frame and opening', 'Select operation, frame and glazing together', 'Choose the installation method after inspection', 'Document supply, sealing and finishing in writing'],
    breadcrumbs: [],
    sections: [
      {
        id: 'when-to-replace', eyebrow: 'Start with the reason', title: 'When replacement is the appropriate scope.',
        paragraphs: [
          'Drafts, condensation, difficult operation and visible deterioration do not all point to the same repair. Interior surface condensation can reflect indoor humidity and cold weather; moisture between panes usually indicates a failed sealed unit; staining around the opening may involve exterior water management. The first step is to separate the symptom from its cause.',
          'Replacement is more compelling when the frame is damaged, the unit cannot be adjusted into reliable operation, repeated failures affect several windows, or the existing configuration cannot meet ventilation, egress, comfort or maintenance needs. A sound frame with an isolated hardware problem may justify repair instead.'
        ],
        cards: [
          { title: 'Sash, glass and hardware', text: 'An operating sash, sealed glass unit, lock or operator may sometimes be repaired without replacing the complete frame. Availability and condition determine whether that approach is practical.' },
          { title: 'Window frame', text: 'The frame connects the sash and glass to the wall opening. Frame condition, drainage, alignment and surrounding finishes influence the replacement method.' },
          { title: 'Rough opening', text: 'The framed opening in the wall becomes visible during full-frame work. Hidden deterioration, insulation gaps and water-management details can then be assessed directly.' }
        ]
      },
      {
        id: 'selection', eyebrow: 'Product decisions', title: 'Choose the window around the room and exposure.',
        paragraphs: [
          'Operating style changes ventilation, screen location, cleaning, hardware reach and clear opening. Casements and awnings use hinged sashes; hung and slider windows move within the frame; picture and fixed units do not open. Combinations can place ventilation where it is useful while preserving glass area elsewhere.',
          'Glazing should be evaluated as a whole-window package. Pane count, low-emissivity coatings, gas fills, spacers, frame construction and air leakage all contribute to performance. Orientation matters too: solar gain that is useful on one elevation may be uncomfortable on another.'
        ],
        cards: [
          { title: 'Operation', text: 'Match opening direction, ventilation and cleaning access to the room. Confirm hardware reach, screen placement and applicable egress needs.' },
          { title: 'Glazing', text: 'Review pane count, coatings, spacer and gas-fill options together with window size, operation and exposure.' },
          { title: 'Appearance', text: 'Frame colour, exterior profile, sightlines, grids, mullions, interior jambs and trim affect the finished opening.' },
          { title: 'Performance', text: 'Use whole-window ratings for the exact configuration. Centre-of-glass values do not describe the complete product.' }
        ]
      },
      {
        id: 'project-sequence', eyebrow: 'Measured project sequence', title: 'A replacement project should move through clear checkpoints.',
        paragraphs: [
          'Product dimensions cannot be finalized until the existing frame, wall and finish conditions are understood. Likewise, the installation method should not be chosen only from a photograph or assumed standard size.',
          'After installation, each operating unit should be checked for smooth movement, locking and alignment. Interior and exterior finishes should be reviewed against the written scope before handoff.'
        ],
        steps: [
          { title: 'Assess', text: 'Review operation, frame condition, visible moisture evidence, cladding, trim, access and the reason for replacement.' },
          { title: 'Measure', text: 'Record opening dimensions, frame depth, sill and head conditions, wall thickness and finish interfaces.' },
          { title: 'Specify', text: 'Confirm style, configuration, glazing, colour, hardware, screens, installation method and finish direction.' },
          { title: 'Quote', text: 'Separate product supply, removal, installation, sealing, disposal and interior or exterior finishing.' },
          { title: 'Install', text: 'Protect the work area, remove the agreed components, prepare the opening, set the unit, insulate and manage exterior water.' },
          { title: 'Hand off', text: 'Complete included finishes, adjust operation, remove debris and review the work and documentation.' }
        ]
      },
      {
        id: 'price-and-quote', eyebrow: 'Commercial clarity', title: 'Price follows the product configuration and the work around it.',
        paragraphs: [
          'Window size, operating style, frame colour, glazing, grids and configuration influence product cost. Installation changes with replacement method, access, floor level, opening condition, interior jamb and trim, exterior capping or brickmould, disposal and structural changes. A window count is not enough to establish a reliable installed price.',
          'A useful quotation identifies the selected window, major options, measured quantity, installation method, removal and disposal, air- and water-sealing scope, finishes, exclusions, warranty documentation and how concealed damage or scope changes will be handled.'
        ],
        callout: { title: 'Exact product identification belongs in the quotation', text: 'Public product families help narrow operation, material and configuration. The written quotation should identify the exact manufacturer, model, performance documentation and installation scope selected for the measured project.' }
      }
    ],
    productReferences: ['WRP-W001', 'WRP-W003', 'WRP-W004', 'WRP-W008'],
    relatedLinks: [
      { title: 'Window installation', description: 'Review the professional installation sequence and finish scope.', href: '/window-installation/' },
      { title: 'Full-frame replacement', description: 'Understand what changes when the existing frame is removed.', href: '/window-replacement/full-frame/' },
      { title: 'Retrofit replacement', description: 'See when retaining a sound existing frame can be reasonable.', href: '/window-replacement/retrofit/' },
      { title: 'Window replacement cost', description: 'Review the factors used to assemble an installed quotation.', href: '/window-replacement-cost/' },
      { title: 'Window styles', description: 'Compare common operating and fixed configurations.', href: '/guides/window-styles/' },
      { title: 'Energy-efficient windows', description: 'Understand whole-window performance terminology.', href: '/energy-efficient-windows/' }
    ],
    heroReference: 'WRP-W001', visualReferences: ['WRP-W003', 'WRP-W004', 'WRP-W008'], technicalMediaKeys: ['window-casement-profile'],
    visualGap: 'No verified public-safe frame-to-wall installation sequence is available; the page uses a reviewed product profile without implying a specific installation detail.'
  },
  {
    path: '/window-installation/', kind: 'service', cluster: 'windows', eyebrow: 'Professional installation scope',
    title: 'What a complete window installation actually involves.',
    metaTitle: 'Window Installation Process | Window Replacement Pro',
    metaDescription: 'Learn how professional replacement-window installation covers assessment, removal, opening preparation, setting, sealing, water management, finishing and adjustment.',
    lead: 'A well-specified window still depends on how it is fitted to the wall. Professional installation connects the manufactured unit to the rough opening, insulation, exterior drainage plane and interior finish without turning homeowner education into unsafe structural instruction.',
    intro: [
      'Installation begins before removal. The existing frame, sill, exterior cladding, interior trim, access and visible signs of moisture must be reviewed so that the quotation reflects the likely work. The measured opening determines product dimensions and helps identify whether full-frame or insert replacement is appropriate.',
      'The sequence below describes what homeowners should expect to see addressed. Fastener patterns, flashing details and structural repairs vary with the product, wall assembly, code requirements and site conditions; those details belong with trained installers and the selected system instructions.'
    ],
    highlights: ['Opening assessment before final order', 'Plumb, level and square installation', 'Continuous air sealing and exterior water management', 'Final operation, finish and cleanup checks'],
    breadcrumbs: [],
    sections: [
      {
        id: 'assessment', eyebrow: 'Before removal', title: 'Assessment and measurement define the installation scope.',
        paragraphs: [
          'Measurements must account for more than visible glass. The installer reviews frame condition, wall thickness, sill slope, jamb depth, exterior return and interior trim. Out-of-square openings, joined units and unusual cladding can affect manufacturing dimensions and finish work.',
          'Upper floors, large fixed units, restricted exterior access and occupied rooms require handling and protection plans. If there is evidence of active leakage or deterioration, the scope should explain what can be assessed before removal and how concealed conditions will be addressed.'
        ],
        cards: [
          { title: 'Opening condition', text: 'Look for alignment problems, deteriorated material, staining, failed sealants and drainage concerns without assuming a generic symptom proves the cause.' },
          { title: 'Finish interfaces', text: 'Identify casing, jamb extensions, drywall, tile, brickmould, capping, masonry or siding that meets the frame.' },
          { title: 'Product dimensions', text: 'Manufacturing size must allow the unit to be positioned, fastened, insulated and finished within the assessed opening.' },
          { title: 'Work-area protection', text: 'Plan safe access, surface protection, dust control, temporary weather exposure and handling for removed and new units.' }
        ]
      },
      {
        id: 'installation-sequence', eyebrow: 'On installation day', title: 'Removal, preparation and setting happen in a controlled order.',
        paragraphs: [
          'Insert work retains defined existing-frame components; full-frame work removes the old frame and exposes more of the wall opening. The crew clears loose material, reviews newly visible conditions and confirms that the opening can receive the new unit.',
          'The window is positioned level, plumb and square, with shims and fasteners supporting the frame without distortion. Joined assemblies and large units need particular attention to support and alignment. Operation is checked during setting rather than after every finish is complete.'
        ],
        steps: [
          { title: 'Protect and prepare', text: 'Establish access, protect surfaces and stage the unit before the old window is opened to weather.' },
          { title: 'Remove the agreed components', text: 'Follow the full-frame or retrofit boundary and preserve adjacent finishes intended to remain.' },
          { title: 'Inspect the exposed opening', text: 'Review substrate, sill, drainage and deterioration. Pause for an agreed scope change where required.' },
          { title: 'Set and support the unit', text: 'Position, shim and fasten according to the selected system while maintaining frame geometry.' },
          { title: 'Seal and manage water', text: 'Create the specified interior air seal and exterior water-management connection without blocking drainage.' },
          { title: 'Finish and adjust', text: 'Complete included trim or capping, adjust hardware, clean glass and remove debris.' }
        ]
      },
      {
        id: 'sealing', eyebrow: 'Building-envelope connections', title: 'Insulation, air sealing and water management are different jobs.',
        paragraphs: [
          'Insulation limits heat flow through the gap around the frame, but insulation alone is not an air barrier. The interior connection should control air and indoor moisture entering the joint. The exterior connection should shed water while respecting wall and window drainage.',
          'A thick exterior sealant bead is not a substitute for coherent water management. Sill conditions, membranes, drainage cavities and cladding differ between homes. The approach must be coordinated with the exposed assembly.'
        ],
        cards: [
          { title: 'Perimeter insulation', text: 'Limit heat transfer without bowing the frame or interfering with operation.' },
          { title: 'Interior air seal', text: 'Limit air and moisture movement from the room into the perimeter joint with a compatible continuous connection.' },
          { title: 'Exterior water management', text: 'Direct rainwater outward while preserving intended wall and window drainage paths.' }
        ]
      },
      {
        id: 'handoff', eyebrow: 'Completion standard', title: 'The final check covers operation, finishes and documentation.',
        paragraphs: [
          'Every operating sash should open, close and lock without binding. Screens, hardware, drainage openings and visible sealant joints should be reviewed. Interior and exterior finishes should match the written scope, and the work area should be clean.',
          'The homeowner should receive or know how to access applicable warranty information. The final review is also the time to record any outstanding finish item rather than assume it will be remembered later.'
        ],
        callout: { title: 'Installation scope belongs in writing', text: 'State the replacement method, removal and disposal, perimeter insulation and sealing, finishing, access assumptions, exclusions and the process for concealed damage.' }
      }
    ],
    productReferences: ['WRP-W001', 'WRP-W004', 'WRP-W008'],
    relatedLinks: [
      { title: 'Complete window replacement', description: 'Return to the complete product-and-installation planning sequence.', href: '/window-replacement/' },
      { title: 'Full-frame replacement', description: 'Review the method that exposes the rough opening.', href: '/window-replacement/full-frame/' },
      { title: 'Retrofit replacement', description: 'Review the method that retains a serviceable frame.', href: '/window-replacement/retrofit/' },
      { title: 'Full-frame vs retrofit', description: 'Compare both methods condition by condition.', href: '/guides/full-frame-vs-retrofit-windows/' }
    ],
    heroReference: 'WRP-W004', visualReferences: ['WRP-W001', 'WRP-W008'], technicalMediaKeys: ['window-casement-profile'],
    visualGap: 'A verified public-safe step-by-step installation photo series is not available; technical imagery is limited to a neutral product profile.'
  }
];

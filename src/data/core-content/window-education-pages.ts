import type { CoreContentPage } from '../core-content';

export const windowEducationPages: CoreContentPage[] = [
  {
    path: '/energy-efficient-windows/', kind: 'guide', cluster: 'windows', eyebrow: 'Whole-window performance',
    title: 'Energy-efficient windows, explained for homeowners.',
    metaTitle: 'Energy-Efficient Windows Explained | Window Replacement Pro',
    metaDescription: 'Understand whole-window U-factor, Energy Rating, solar heat gain, Low-E coatings, gas fills, spacers, glazing layers, frames, air leakage and installation.',
    lead: 'Energy performance comes from the complete window: glass, spacer, sash, frame, seals, size and installation. A single glass feature cannot describe how the unit performs in the wall.',
    intro: [
      'Performance labels can be difficult to compare because several values describe different behaviours. U-factor addresses heat transfer, solar heat-gain coefficient addresses admitted solar energy, Energy Rating combines factors under a defined method where applicable, and air-leakage ratings address movement through the tested product.',
      'Use values for the exact configuration in the quotation. Different sizes, operating styles and glass packages within the same family can have different ratings. Installation then determines how effectively the rated window connects to the home.'
    ],
    highlights: ['Compare whole-window values', 'Match glass coatings to exposure', 'Treat air leakage separately from insulation', 'Connect the rated product to a complete installation'],
    breadcrumbs: [],
    sections: [
      {
        id: 'ratings', eyebrow: 'Performance language', title: 'Know what each rating is intended to describe.',
        paragraphs: [
          'U-factor measures the rate of heat transfer through the rated assembly; lower values indicate less transfer. Energy Rating or ER, where applicable, combines heat loss, solar gain and air leakage under a standardized calculation. It should not be read as a percentage saving for a particular house.',
          'Solar heat-gain coefficient describes the fraction of incident solar energy admitted through the window. A lower or higher value is not universally better: orientation, shading, season and comfort goals matter. Condensation resistance is another comparative measure and does not predict condensation without indoor humidity and outdoor temperature.'
        ],
        cards: [
          { title: 'U-factor', text: 'Whole-window heat-transfer rate. Compare the same unit system and exact product configuration.' },
          { title: 'Energy Rating / ER', text: 'A standardized comparative value where reported; not a promise of household energy savings.' },
          { title: 'SHGC', text: 'Solar heat-gain coefficient. Consider elevation, shading and seasonal comfort rather than treating lower as automatically better.' },
          { title: 'Air leakage', text: 'Measures air movement through the tested window. Installation leakage around the frame is a separate site condition.' }
        ]
      },
      {
        id: 'glazing', eyebrow: 'Insulated glass', title: 'Pane count, coatings, gas and spacers work as a package.',
        paragraphs: [
          'Low-emissivity coatings reduce radiant heat transfer and can be selected with different solar characteristics. Coating surface placement depends on the insulated-glass design. Gas fills such as argon reduce conductive and convective transfer within a sealed cavity when the unit is manufactured and remains sealed as designed.',
          'The spacer separates panes at the glass edge, where thermal conditions differ from the centre. Pane count changes the number of cavities and overall weight, but verified performance still depends on coatings, fills, spacer, glass thickness and the surrounding frame.'
        ],
        cards: [
          { title: 'Low-E coating', text: 'A thin low-emissivity layer that changes radiant heat transfer and, depending on its design, solar gain.' },
          { title: 'Gas fill', text: 'A specified gas within the sealed cavity used to reduce heat transfer compared with ordinary air in the same design.' },
          { title: 'Spacer system', text: 'Separates panes and seals the edge of the insulated-glass unit; edge temperature and durability matter.' },
          { title: 'Double or triple glazing', text: 'Two or three panes in typical construction, with different cavity count, weight, cost and potential performance.' }
        ]
      },
      {
        id: 'frame-installation', eyebrow: 'Beyond the glass', title: 'Frame, operation and installation complete the thermal path.',
        paragraphs: [
          'Frame material, internal chambers, reinforcement, sash design and meeting rails affect heat flow and air sealing. Fixed windows avoid operating joints; casements and awnings often close against compression seals; sliders and hung windows use different moving interfaces. Each can perform well when properly designed and adjusted.',
          'At installation, gaps around the frame need insulation plus a continuous interior air seal and appropriate exterior water management. A high-rated window installed into a poorly sealed or deteriorated opening cannot deliver the intended whole-project result.'
        ],
        table: { caption: 'Whole-window performance checklist', columns: ['Component', 'What to confirm'], rows: [
          ['Glass package', 'Pane count, Low-E direction, gas fill, spacer and safety or specialty glass.'],
          ['Frame and sash', 'Material, profile, reinforcement and the exact operating or fixed configuration.'],
          ['Published values', 'Whole-window U-factor, ER or SHGC where applicable for the quoted size and configuration.'],
          ['Air control', 'Product air-leakage information and a specified frame-to-opening air seal.'],
          ['Water management', 'Window drainage and connection to the wall’s exterior water-management approach.'],
          ['Installation and finish', 'Replacement method, perimeter insulation, trim, capping and final adjustment.']
        ] }
      },
      {
        id: 'selection', eyebrow: 'Buying decision', title: 'Set a performance objective before choosing features.',
        paragraphs: [
          'Identify whether the project priority is comfort near glass, reduced heat transfer, solar control, condensation resistance, sound or a combination. Then compare verified configurations that meet the room’s ventilation, size and operation needs.',
          'Avoid universal energy-savings claims. Results depend on existing conditions, wall area, air leakage, orientation, mechanical systems and occupant behaviour. The quotation should identify the exact performance documentation used for selection.'
        ],
        callout: { title: 'Whole-window values belong in the written quotation', text: 'Public families explain useful directions. The exact glass package, ratings and documentation are confirmed for the measured size and operating configuration.' }
      }
    ],
    productReferences: ['WRP-W002', 'WRP-W003', 'WRP-W004', 'WRP-W009'],
    relatedLinks: [
      { title: 'Double vs triple pane', description: 'Compare the practical effect of another glass layer.', href: '/guides/double-vs-triple-pane-windows/' },
      { title: 'Window styles', description: 'See how fixed and operating designs differ.', href: '/guides/window-styles/' },
      { title: 'Window installation', description: 'Review the frame-to-opening installation scope.', href: '/window-installation/' },
      { title: 'Window replacement cost', description: 'See where performance options affect the quotation.', href: '/window-replacement-cost/' }
    ],
    heroReference: 'WRP-W009', visualReferences: ['WRP-W002', 'WRP-W003', 'WRP-W004'], technicalMediaKeys: ['window-casement-profile', 'window-deep-frame-profile', 'window-double-hung-profile'],
    visualGap: 'Verified profiles support frame discussion, but a supplier-neutral Low-E coating or spacer macro image is still missing.'
  },
  {
    path: '/guides/casement-vs-slider-windows/', kind: 'guide', cluster: 'windows', eyebrow: 'Operating-style comparison',
    title: 'Casement vs slider windows.',
    metaTitle: 'Casement vs Slider Windows | Window Replacement Pro',
    metaDescription: 'Compare casement and slider windows by operation, ventilation, air sealing, screen placement, cleaning, opening geometry, appearance and suitable rooms.',
    lead: 'Casements project outward on hinges. Sliders move horizontally within the frame. That difference changes ventilation, screen position, hardware, cleaning and the shape of the clear opening.',
    intro: [
      'Both styles can be suitable replacement choices when the opening and room support them. Casements are often selected for compression-style closing and broad sash opening; sliders are useful where outward projection is undesirable and a horizontal opening suits the elevation.',
      'The comparison should use the exact quoted systems. Frame profile, seals, hardware, glass package and size can matter as much as the generic operating category.'
    ],
    highlights: ['Hinged projection versus horizontal movement', 'Different screen and cleaning arrangements', 'Opening geometry changes ventilation', 'Exact performance depends on the quoted system'],
    breadcrumbs: [{ label: 'Guides', href: '/guides/' }],
    sections: [
      {
        id: 'comparison', eyebrow: 'Side by side', title: 'The operating direction creates the main tradeoffs.',
        paragraphs: ['Use the table as a planning aid, then confirm hardware reach, clear opening, egress and exterior clearance at the measured opening.'],
        table: { caption: 'Casement and slider comparison', columns: ['Consideration', 'Casement', 'Slider'], rows: [
          ['Operation', 'Side-hinged sash projects outward, typically operated by a handle and crank.', 'Sash moves horizontally within frame tracks.'],
          ['Ventilation', 'Open sash can catch and direct breezes; broad opening depends on size and hardware.', 'Ventilation is generally limited to the open portion of the frame.'],
          ['Air sealing', 'Often closes against compression seals; compare verified whole-window values.', 'Uses sliding seals and meeting rails; compare the exact tested system.'],
          ['Screen placement', 'Usually on the interior because the sash opens outward.', 'Commonly positioned to serve the sliding opening; layout varies by system.'],
          ['Cleaning', 'Hinged access varies with sash design and floor level.', 'Removable or tilting sash features vary; exterior access may still be needed.'],
          ['Opening geometry', 'Creates an outward projection and a relatively tall clear opening.', 'No exterior projection and suits wider horizontal openings.'],
          ['Appearance', 'Vertical sash proportions and minimal meeting-rail interruption.', 'Horizontal meeting rails and track profile are part of the view.']
        ] }
      },
      {
        id: 'room-fit', eyebrow: 'Room and exposure', title: 'Exterior clearance and interior use narrow the choice.',
        paragraphs: [
          'Casements should not project into walkways or locations where exterior obstacles, trees, decks or maintenance access make an open sash impractical. Interior screens need to work with blinds, curtains and cleaning access.',
          'Sliders avoid exterior projection and can be straightforward over counters or in bedrooms where a wide opening is available. Confirm hardware reach, screen arrangement, sill maintenance and applicable egress dimensions.'
        ],
        cards: [
          { title: 'Consider casement for', text: 'Openings with exterior clearance, a desire for broad ventilation and suitable access to the operator and interior screen.' },
          { title: 'Consider slider for', text: 'Wider openings, areas where outward projection is undesirable and rooms suited to horizontal sash movement.' },
          { title: 'Check either style for', text: 'Egress, safety glazing, reach, room layout, exterior obstacles, water exposure and the exact glass package.' }
        ]
      },
      {
        id: 'performance', eyebrow: 'Performance and maintenance', title: 'Do not convert a general tendency into a universal claim.',
        paragraphs: [
          'Casement compression seals can support strong air performance, but frame construction, hardware adjustment and installation still matter. A well-designed slider can also meet demanding requirements. Compare tested whole-window ratings for the exact configuration.',
          'Tracks, drainage paths, seals, operators, locks and screens need periodic cleaning and adjustment appropriate to the system. Selection should account for who will operate and maintain the window.'
        ],
        callout: { title: 'Compare exact configurations', text: 'The public family describes the operating direction. The written quotation should identify size, glazing, tested performance, screen, hardware and installation scope.' }
      }
    ],
    productReferences: ['WRP-W001', 'WRP-W002', 'WRP-W006', 'WRP-W007'],
    relatedLinks: [
      { title: 'Window styles', description: 'Compare the rest of the operating and fixed choices.', href: '/guides/window-styles/' },
      { title: 'Energy-efficient windows', description: 'Understand whole-window values and air leakage.', href: '/energy-efficient-windows/' },
      { title: 'Window replacement', description: 'Connect style selection to the full project.', href: '/window-replacement/' },
      { title: 'Browse windows', description: 'Review approved public casement and slider families.', href: '/windows/#catalogue' }
    ],
    heroReference: 'WRP-W001', visualReferences: ['WRP-W002', 'WRP-W006', 'WRP-W007'], technicalMediaKeys: ['window-casement-profile', 'window-slider-profile']
  },
  {
    path: '/guides/window-problems/', kind: 'guide', cluster: 'windows', eyebrow: 'Symptom and next-step hub',
    title: 'Common window problems and what they can mean.',
    metaTitle: 'Common Window Problems | Window Replacement Pro',
    metaDescription: 'Review drafts, condensation, failed sealed units, difficult operation, leakage, frame deterioration, hardware damage and exterior noise without overdiagnosis.',
    lead: 'A symptom is evidence, not a diagnosis. Drafts, moisture and difficult operation can originate at the glass, sash, frame, installation joint, wall or indoor environment. This guide helps organize the next inspection without making structural or moisture claims from generic signs.',
    intro: [
      'Some problems are repairable component issues. Others indicate a failing sealed unit, unsuitable frame or broader opening condition. Record when the symptom occurs, where it appears and whether it affects one window or many before deciding that replacement is the only response.',
      'Active water entry, soft material, visible mould, suspected hazardous material or structural movement needs qualified site assessment. A web page cannot establish the source or safe repair scope.'
    ],
    highlights: ['Separate symptom from cause', 'Record location and conditions', 'Distinguish component repair from replacement', 'Escalate active moisture and structural concerns'],
    breadcrumbs: [{ label: 'Guides', href: '/guides/' }],
    sections: [
      {
        id: 'air-moisture', eyebrow: 'Air and moisture', title: 'Drafts and condensation have several possible sources.',
        paragraphs: [
          'A draft may come through worn sash seals, an unlatched or misaligned operator, frame joints, the perimeter installation joint or nearby wall assemblies. Smoke pencils or invasive testing should be handled appropriately; a hand near the glass can also interpret normal radiant cooling as moving air.',
          'Room-side condensation forms when an interior surface falls below the dew point of indoor air. Humidity, outdoor temperature, coverings and air circulation all matter. Moisture between panes is different and commonly indicates loss of the insulated-glass seal.'
        ],
        cards: [
          { title: 'Drafts', text: 'Note whether air is felt at the sash, lock, frame perimeter or adjacent trim and whether adjustment changes it.' },
          { title: 'Interior condensation', text: 'Review humidity, weather, coverings, room airflow and interior surface temperature before blaming one component.' },
          { title: 'Between-pane moisture', text: 'Fogging or deposits within a sealed unit generally point to sealed-glass failure, which may allow glass-only or sash service.' }
        ]
      },
      {
        id: 'operation', eyebrow: 'Movement and hardware', title: 'Difficult operation can be adjustment, wear or frame movement.',
        paragraphs: [
          'Operators, balances, rollers, locks and hinges wear or move out of adjustment. Dirt in tracks and painted or swollen wood components can also affect movement. A qualified inspection should distinguish a replaceable part from frame distortion or installation movement.',
          'Do not force a sash that binds or support heavy glass with improvised hardware. Record the product type, failed function and any available documentation before seeking parts or replacement.'
        ],
        cards: [
          { title: 'Hard to open or close', text: 'Check for track debris, obvious obstruction and whether the sash is aligned, without dismantling structural or spring-loaded components.' },
          { title: 'Lock will not engage', text: 'May reflect adjustment, worn hardware or frame geometry; forcing the lock can damage components.' },
          { title: 'Damaged operator or balance', text: 'Part availability, glass weight and sash condition determine whether service is practical.' }
        ]
      },
      {
        id: 'water-frames', eyebrow: 'Water and deterioration', title: 'Leakage around a window needs source tracing, not a sealant guess.',
        paragraphs: [
          'Water appearing at the sill can enter through the window, failed exterior joints, cladding, flashing, roof or wall paths above. The visible location may be far from the entry point. Applying sealant without understanding drainage can conceal evidence or trap water.',
          'Peeling finish, corrosion, soft wood, staining and movement should be documented. Active leakage and deteriorated framing deserve prompt qualified assessment. Replacement may become part of the repair, but it should be coordinated with the source and affected wall materials.'
        ],
        cards: [
          { title: 'Water leakage', text: 'Record weather direction, timing, path and interior location; do not assume the nearest joint is the source.' },
          { title: 'Frame deterioration', text: 'Soft, corroded, cracked or distorted material can make frame retention unsuitable.' },
          { title: 'Concealed conditions', text: 'Damage behind trim or cladding cannot be confirmed from the room alone and may change the repair scope after opening.' }
        ]
      },
      {
        id: 'noise-next-steps', eyebrow: 'Sound and next steps', title: 'Exterior noise is a system issue, not only a pane-count issue.',
        paragraphs: [
          'Sound paths can include glass, sash seals, trickle vents, frame joints, installation gaps and adjacent walls. Glass thickness, asymmetry, cavity spacing and tested ratings are more informative than assuming triple panes solve every noise concern.',
          'Use the pattern of symptoms to decide between adjustment, component repair, sealed-unit replacement, a professional moisture investigation or complete window replacement. When replacement is considered, include the original problem in the written selection and installation goals.'
        ],
        callout: { title: 'This hub does not diagnose a building remotely', text: 'It organizes observations and referral decisions. Active leakage, structural movement, extensive deterioration or health concerns require appropriate on-site professionals.' }
      }
    ],
    productReferences: ['WRP-W001', 'WRP-W005', 'WRP-W006', 'WRP-W008'],
    relatedLinks: [
      { title: 'Window replacement', description: 'See when a complete replacement scope can be appropriate.', href: '/window-replacement/' },
      { title: 'Window installation', description: 'Understand frame-to-opening connections and final checks.', href: '/window-installation/' },
      { title: 'Energy-efficient windows', description: 'Review air leakage and condensation-resistance concepts.', href: '/energy-efficient-windows/' },
      { title: 'Full-frame vs retrofit', description: 'Compare access to concealed opening conditions.', href: '/guides/full-frame-vs-retrofit-windows/' }
    ],
    heroReference: 'WRP-W005', visualReferences: ['WRP-W001', 'WRP-W006', 'WRP-W008'], technicalMediaKeys: ['window-double-hung-profile'],
    visualGap: 'Problem-specific moisture photos are withheld because generic images could imply a diagnosis; the page uses neutral products and a frame profile only.'
  }
];

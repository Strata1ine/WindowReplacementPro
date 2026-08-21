import type { CoreContentPage } from '../core-content';

export const windowGuidePages: CoreContentPage[] = [
  {
    path: '/guides/full-frame-vs-retrofit-windows/', kind: 'guide', cluster: 'windows', eyebrow: 'Installation comparison',
    title: 'Full-frame vs retrofit window replacement.',
    metaTitle: 'Full-Frame vs Retrofit Windows | Window Replacement Pro',
    metaDescription: 'Compare full-frame and retrofit window replacement by retained frame, opening size, inspection access, finishes, disruption, suitable conditions and relative cost.',
    lead: 'The methods differ mainly in what stays, what becomes visible and how much surrounding finish work follows. Neither method is automatically correct for every opening.',
    intro: [
      'Full-frame replacement removes the existing main frame and exposes more of the perimeter. Retrofit replacement keeps a suitable frame and installs the new unit inside it. That distinction affects opening size, concealed-condition visibility, labour, finish work and cost.',
      'The comparison is useful only after inspection. A fast insert into an unsuitable frame is not a saving, while full-frame removal around a sound, well-integrated frame may add work without solving a project need.'
    ],
    highlights: ['Choose after assessing the existing frame', 'Compare clear-opening and finish effects', 'Define retained and removed components', 'Allow for concealed conditions'],
    breadcrumbs: [{ label: 'Guides', href: '/guides/' }],
    sections: [
      {
        id: 'comparison', eyebrow: 'Side by side', title: 'How the methods differ in practical terms.',
        paragraphs: ['The table describes common implications, not a substitute for a site-specific scope. Existing construction and finishes vary, and the quotation should define the actual removal boundary for each opening.'],
        table: { caption: 'Full-frame and retrofit comparison', columns: ['Decision factor', 'Full-frame replacement', 'Retrofit / insert replacement'], rows: [
          ['Existing main frame retained?', 'No. The main old frame is removed.', 'Yes, when assessed as suitable to remain.'],
          ['Glass and opening-size impact', 'Can preserve more of the original opening, subject to the new profile.', 'Some clear opening is typically lost because the new frame sits inside the old one.'],
          ['Rough-opening visibility', 'More sill, substrate and perimeter becomes visible.', 'Limited because the main frame remains.'],
          ['Hidden damage inspection', 'Better access around the removed frame.', 'Conditions behind the retained frame remain concealed.'],
          ['Interior finishing', 'Jambs, casing, drywall or returns may need rebuilding.', 'Often less disruptive, though transition trim may be required.'],
          ['Exterior finishing', 'Brickmould, capping, siding or masonry may be affected.', 'Existing returns may remain, be modified or be replaced.'],
          ['Installation disruption', 'Usually greater because removal and finish boundaries are broader.', 'Often lower where retained conditions are straightforward.'],
          ['Relative cost', 'Commonly higher because scope and concealed-condition exposure increase.', 'Commonly lower for a suitable uncomplicated opening.'],
          ['Suitable conditions', 'Unsuitable old frame, perimeter access needs, finish renovation or opening goals.', 'Sound old frame, acceptable opening reduction and finishes worth retaining.']
        ] }
      },
      {
        id: 'decision', eyebrow: 'Decision criteria', title: 'Use opening condition to narrow the choice.',
        paragraphs: [
          'Start with frame integrity and water management. Deterioration, distortion, recurring leakage or uncertain perimeter details weigh against retention. Then compare finished sightlines and opening size. An insert that technically fits may still produce an undesirable glass or operating opening.',
          'Connected finishes matter too. Full-frame work is easier to justify when casing, jambs, capping or cladding are already being replaced. Retrofit may be attractive where those finishes are sound and the old frame provides a stable base.'
        ],
        cards: [
          { title: 'Prefer full frame when…', text: 'The old frame is unsuitable, perimeter access is important, the insert reduces the opening too much, or broad finish work is planned.' },
          { title: 'Consider retrofit when…', text: 'The old frame is sound and dry, the reduced opening remains practical, and retaining connected finishes has value.' },
          { title: 'Investigate further when…', text: 'There is unexplained staining, active leakage, soft material, out-of-square conditions or uncertainty at the wall connection.' }
        ]
      },
      {
        id: 'cost', eyebrow: 'Cost and disruption', title: 'Lower initial scope helps only when retained conditions support it.',
        paragraphs: [
          'Retrofit often requires less removal and finish work, so labour and material can be lower. Full-frame projects usually involve more preparation, sealing and rebuilding. These are relative tendencies, not public price ranges; size, access and product selection still matter.',
          'Full-frame work exposes more and can reveal necessary repairs. Retrofit limits that exposure but should not cover known deterioration. Ask how the quotation handles conditions discovered after removal.'
        ],
        callout: { title: 'Compare written scopes, not labels', text: 'Two quotations using the same installation label can include different trim, capping, sealing and disposal work. Detailed inclusions make the comparison meaningful.' }
      },
      {
        id: 'questions', eyebrow: 'Before approval', title: 'Questions that clarify the proposed method.',
        paragraphs: [
          'Ask which components remain, how the frame was assessed, how much clear opening the new profile leaves and what finishes are included. Confirm how the perimeter will be insulated, air sealed and connected to exterior water management.',
          'Ask what happens if removal reveals deterioration outside the scope. A clear approval process prevents hurried decisions around an open wall.'
        ],
        cards: [
          { title: 'What exactly is removed?', text: 'Identify sash, stops, main frame, jambs, casing and exterior capping individually.' },
          { title: 'What opening remains?', text: 'Review the finished frame sightline, glass area and egress implication.' },
          { title: 'What finish is included?', text: 'List trim, jamb work, capping or brickmould, sealant and excluded paint or wall repair.' },
          { title: 'How are surprises handled?', text: 'Document allowances, exclusions or approvals for concealed deterioration.' }
        ]
      }
    ],
    productReferences: ['WRP-W001', 'WRP-W004', 'WRP-W008'],
    relatedLinks: [
      { title: 'Full-frame replacement', description: 'Read the detailed removal, access and finishing scope.', href: '/window-replacement/full-frame/' },
      { title: 'Retrofit replacement', description: 'Read the retained-frame scope and tradeoffs.', href: '/window-replacement/retrofit/' },
      { title: 'Window installation', description: 'Review the professional installation sequence.', href: '/window-installation/' },
      { title: 'Window replacement cost', description: 'See how method and finish affect cost structure.', href: '/window-replacement-cost/' }
    ],
    heroReference: 'WRP-W008', visualReferences: ['WRP-W004', 'WRP-W001'], technicalMediaKeys: ['window-casement-profile', 'window-slider-profile'],
    visualGap: 'Direct wall cutaways are not verified for public use; the page pairs neutral frame profiles with a code-native method diagram.'
  },
  {
    path: '/guides/double-vs-triple-pane-windows/', kind: 'guide', cluster: 'windows', eyebrow: 'Glazing comparison',
    title: 'Double-pane vs triple-pane windows.',
    metaTitle: 'Double vs Triple Pane Windows | Window Replacement Pro',
    metaDescription: 'Compare double and triple glazing by construction, thermal performance, weight, cost, sound, condensation resistance, climate and operating-window considerations.',
    lead: 'Triple glazing adds another glass layer and sealed space. That can improve whole-window thermal performance and interior-glass temperatures, but it also adds weight and cost. The right choice depends on the complete window, opening and comfort objective.',
    intro: [
      'A double-pane insulated glass unit normally has two panes separated by one sealed cavity. Triple-pane construction normally has three panes and two cavities. Coatings, gas fills, spacer design, glass thickness and frame integration vary, so pane count alone does not define performance.',
      'Compare published whole-window values for the exact size and operating style in the quotation. A centre-of-glass value or a generic pane-count claim does not describe the frame, edge of glass, sash or air leakage.'
    ],
    highlights: ['Triple glazing adds a pane and sealed cavity', 'Whole-window ratings matter more than pane count alone', 'Added glass changes weight and cost', 'Comfort goals and window operation guide selection'],
    breadcrumbs: [{ label: 'Guides', href: '/guides/' }],
    sections: [
      {
        id: 'construction', eyebrow: 'What changes', title: 'The extra layer affects more than thermal resistance.',
        paragraphs: [
          'Another pane and cavity can reduce heat transfer through the glass package and raise the indoor surface temperature in cold weather. That can improve comfort near the window and may increase condensation resistance under the same indoor and outdoor conditions.',
          'The extra glass increases sealed-unit weight. Sash size, hinges, operators, balances and frame design must support it. This is why the available glazing package can vary by window style and dimensions.'
        ],
        table: { caption: 'Double- and triple-pane comparison', columns: ['Consideration', 'Double pane', 'Triple pane'], rows: [
          ['Glass construction', 'Two panes with one sealed cavity in a typical configuration.', 'Three panes with two sealed cavities in a typical configuration.'],
          ['Thermal performance', 'Can provide strong performance with suitable coatings, gas fill, spacer and frame.', 'Can improve thermal performance where the complete window is designed for it.'],
          ['Weight', 'Lower sealed-unit weight for a comparable size.', 'Higher weight, affecting hardware and size availability.'],
          ['Cost', 'Generally lower within the same product and option set.', 'Generally higher because of added glass, assembly and handling.'],
          ['Sound', 'Performance depends on glass thickness, spacing, seals and the complete opening.', 'An extra pane may help in some assemblies, but pane count alone does not guarantee a sound rating.'],
          ['Condensation resistance', 'Depends on indoor humidity, exterior temperature and complete window performance.', 'Warmer interior glass can help, but indoor humidity and installation still matter.']
        ] }
      },
      {
        id: 'performance', eyebrow: 'Comfort and climate', title: 'Climate relevance depends on the actual performance package.',
        paragraphs: [
          'Ontario heating conditions make heat loss and interior surface temperatures important, but solar exposure varies by elevation and season. Low-emissivity coating placement and solar heat-gain characteristics should be considered with pane count rather than selected separately.',
          'Triple glazing may be valuable for comfort near large glass areas, higher performance targets or specific exposures. Double glazing may remain reasonable where its verified whole-window values meet the project goal and lower weight or cost matters.'
        ],
        cards: [
          { title: 'U-factor', text: 'Lower values indicate less heat transfer through the rated whole window. Compare the exact configuration.' },
          { title: 'Solar heat gain', text: 'Coatings and glass layers affect admitted solar energy. The preferred value can vary by orientation and design goal.' },
          { title: 'Interior glass temperature', text: 'A warmer indoor glass surface can reduce radiant discomfort and improve condensation resistance under the same humidity.' },
          { title: 'Air leakage', text: 'Pane count does not correct poor sash seals or installation. Air leakage remains a separate whole-window consideration.' }
        ]
      },
      {
        id: 'sound-and-operation', eyebrow: 'Practical effects', title: 'Sound and operation need more specific evidence than “more panes.”',
        paragraphs: [
          'Sound control depends on glass thickness, asymmetry, cavity spacing, frame seals and the wall opening. Triple glazing is not automatically the best acoustic assembly. Use a tested rating where noise is a major project goal.',
          'Added weight is most relevant to operating windows. Large casements, awnings and hung sashes rely on hardware sized for the glass package. Fixed windows avoid operating-hardware loads but still require safe handling and structural support.'
        ],
        callout: { title: 'Do not use a universal savings percentage', text: 'Energy use depends on the old windows, new whole-window ratings, home, climate, orientation, heating system and occupant behaviour. The page intentionally makes no generic percentage claim.' }
      },
      {
        id: 'decision', eyebrow: 'Selection questions', title: 'Ask for exact values and compatibility.',
        paragraphs: [
          'Compare the whole-window U-factor or other applicable performance rating for both quoted packages. Confirm low-emissivity coating, gas fill, spacer, safety-glass needs and whether the selected operating size supports triple glazing.',
          'Then weigh the verified performance difference against price, sash weight, appearance and the room’s comfort needs. The decision can differ between elevations or window types in the same project.'
        ],
        cards: [
          { title: 'What exact ratings change?', text: 'Ask for the whole-window values for the measured size and configuration.' },
          { title: 'Is the option available at this size?', text: 'Confirm glass weight and hardware limitations for the operating style.' },
          { title: 'What problem are we solving?', text: 'Identify comfort, performance, condensation resistance or sound as a specific objective.' },
          { title: 'Does orientation matter?', text: 'Review exposure and solar heat gain before repeating one package mechanically across the home.' }
        ]
      }
    ],
    productReferences: ['WRP-W002', 'WRP-W004', 'WRP-W008'],
    relatedLinks: [
      { title: 'Energy-efficient windows', description: 'Review whole-window performance terms.', href: '/energy-efficient-windows/' },
      { title: 'Window replacement cost', description: 'See where glazing enters the quotation.', href: '/window-replacement-cost/' },
      { title: 'Window styles', description: 'Compare operating styles affected by glass weight.', href: '/guides/window-styles/' },
      { title: 'Complete window replacement', description: 'Place glazing within the complete project sequence.', href: '/window-replacement/' }
    ],
    heroReference: 'WRP-W002', visualReferences: ['WRP-W004', 'WRP-W008'], technicalMediaKeys: ['window-deep-frame-profile', 'window-double-hung-profile'],
    visualGap: 'No verified public-safe double-versus-triple sealed-unit cross-section exists; a code-native pane diagram is used with verified frame-profile images for whole-window context.'
  },
  {
    path: '/guides/window-styles/', kind: 'guide', cluster: 'windows', eyebrow: 'Operating and fixed configurations',
    title: 'Window styles and where they fit.',
    metaTitle: 'Window Styles Guide | Window Replacement Pro',
    metaDescription: 'Compare casement, awning, hung, slider, end-vent, picture, fixed, bay, bow and architectural windows by ventilation, cleaning, view and practical use.',
    lead: 'Window style determines how the sash moves, where ventilation enters, how the screen is positioned and what clear opening remains. The useful choice comes from the room, reach, exterior access and desired view—not a style name alone.',
    intro: [
      'Operating windows provide ventilation and may need to meet egress or safety requirements. Fixed windows prioritize glass area and can be combined with operating units. Projecting bay and bow assemblies add structure and finishing considerations beyond a flat window.',
      'The visual examples below show representative window configurations. They demonstrate operation and proportion without promising the exact product, grille, colour or configuration for a future quotation.'
    ],
    highlights: ['Strong visual comparison across major styles', 'Ventilation and cleaning explained', 'Opening geometry and screen placement considered', 'Links to representative product configurations'],
    breadcrumbs: [{ label: 'Guides', href: '/guides/' }],
    sections: [
      {
        id: 'projection', eyebrow: 'Hinged operation', title: 'Casement and awning windows use compression-style closing.',
        paragraphs: [
          'Casements hinge at the side and project outward, often providing a broad opening and strong ventilation. Screens are generally on the interior. The projecting sash needs exterior clearance and hardware access should suit the room.',
          'Awnings hinge at the top and open outward from the bottom. They can provide controlled ventilation in compact openings and combinations. Like casements, they require exterior clearance and rely on operators and seals maintained in adjustment.'
        ],
        cards: [
          { title: 'Casement', text: 'Useful for broad ventilation, compression sealing and clear views; consider reach, exterior clearance and interior screen location.' },
          { title: 'Awning', text: 'Useful for lower or higher placements and combinations; consider exterior projection, operator access and drainage.' }
        ]
      },
      {
        id: 'sliding-sashes', eyebrow: 'Sashes within the frame', title: 'Hung and slider windows ventilate without projecting outward.',
        paragraphs: [
          'Single- and double-hung windows move vertically. A double-hung configuration allows both sashes to move where supported, which can aid ventilation and cleaning. Balance systems, meeting rails and sill conditions affect operation.',
          'Single and double sliders move horizontally and can suit wider openings where exterior projection is undesirable. End-vent sliders place operating sashes around a fixed centre section, creating balanced ventilation across a wider opening.'
        ],
        cards: [
          { title: 'Single hung', text: 'One moving sash with a fixed companion; familiar vertical proportions and no exterior projection.' },
          { title: 'Double hung', text: 'Two moving sashes where configured; review cleaning access, balance operation and clear opening.' },
          { title: 'Single slider', text: 'One horizontal operating sash and one fixed section; simple movement for wider openings.' },
          { title: 'Double slider', text: 'Two horizontal operating sashes; consider screen layout, cleaning and meeting-rail sightlines.' },
          { title: 'End-vent slider', text: 'Operating end sashes around a fixed centre; useful for wide openings, subject to measured configuration.' }
        ]
      },
      {
        id: 'fixed', eyebrow: 'Daylight and views', title: 'Picture and fixed windows do not open.',
        paragraphs: [
          'Picture windows use a non-operating frame direction intended for glass area and views. Fixed units can also use frame profiles coordinated with adjacent operating windows so sightlines align more closely.',
          'Fixed glazing avoids operating hardware and seals, but ventilation must be provided elsewhere where needed. Large glass sizes affect handling, safety requirements, solar exposure and structural support.'
        ],
        cards: [
          { title: 'Picture window', text: 'Prioritizes glass area, daylight and view; useful alone or within larger combinations.' },
          { title: 'Casement-profile fixed', text: 'Uses a deeper profile direction to coordinate with adjacent casement or awning frames.' },
          { title: 'Slim fixed', text: 'Uses a narrower visual profile where the selected system and opening support it.' }
        ]
      },
      {
        id: 'projecting-custom', eyebrow: 'Larger assemblies', title: 'Bay, bow and architectural windows need project-specific review.',
        paragraphs: [
          'Bay windows project in angular sections, while bow windows use several units to create a gentler curve. Both affect structure, roofing or head conditions, exterior finishing and interior seat or jamb work. They should not be treated as a standard flat-window swap.',
          'Architectural shapes, bay and bow assemblies, and custom combinations can solve distinctive openings, but operation, mullions, support, glass size and finish interfaces must be designed together.'
        ],
        callout: { title: 'Style selection happens at the opening', text: 'Confirm ventilation, cleaning, reach, exterior clearance, egress, glass area and finish scope before choosing a style from appearance alone.' }
      }
    ],
    productReferences: ['WRP-W001', 'WRP-W003', 'WRP-W004', 'WRP-W006', 'WRP-W008', 'WRP-W009'],
    relatedLinks: [
      { title: 'Casement vs slider', description: 'Compare two common operating directions.', href: '/guides/casement-vs-slider-windows/' },
      { title: 'Window replacement', description: 'Connect style selection to measurement and installation.', href: '/window-replacement/' },
      { title: 'Energy-efficient windows', description: 'Understand how operation and frame affect performance.', href: '/energy-efficient-windows/' },
      { title: 'Browse replacement windows', description: 'Compare available window styles and configurations.', href: '/windows/#catalogue' }
    ],
    heroReference: 'WRP-W003', visualReferences: ['WRP-W001', 'WRP-W004', 'WRP-W006', 'WRP-W008', 'WRP-W009'], technicalMediaKeys: ['window-casement-profile', 'window-slider-profile', 'window-picture-profile'],
    visualGap: 'Bay and bow imagery is withheld because no current product-specific public-safe family passes the full evidence and media gate.'
  }
];

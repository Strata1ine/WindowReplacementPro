import type { CoreContentPage } from '../core-content';

export const windowMethodPages: CoreContentPage[] = [
  {
    path: '/window-replacement/full-frame/', kind: 'service', cluster: 'windows', eyebrow: 'Installation method',
    title: 'Full-frame window replacement explained.',
    metaTitle: 'Full-Frame Window Replacement | Window Replacement Pro',
    metaDescription: 'Understand full-frame window replacement, including rough-opening access, insulation, concealed damage, trim, exterior finishes, disruption and cost implications.',
    lead: 'Full-frame replacement removes the existing window frame rather than setting the new unit inside it. That creates access to more of the opening, but it also brings the interior and exterior finish interfaces into the project.',
    intro: [
      'The exact removal boundary varies with the existing window and wall. In general, the old sash and main frame are removed so the opening can be inspected before the new unit is installed. Interior casing, jamb extensions, exterior brickmould or capping may also be affected.',
      'Full-frame work is not automatically required for every home. It is valuable when the retained frame is unsuitable, when direct perimeter access is needed, or when product and finish goals justify the broader scope.'
    ],
    highlights: ['Existing main frame removed', 'Greater access to the rough opening', 'Interior and exterior finishes may change', 'Higher scope and disruption than many insert projects'],
    breadcrumbs: [{ label: 'Window replacement', href: '/window-replacement/' }],
    sections: [
      {
        id: 'meaning', eyebrow: 'Removal boundary', title: 'What “full frame” means at the opening.',
        paragraphs: [
          'The old operating parts and glass come out along with the main frame. More of the substrate, sill and perimeter becomes visible than an insert installation would expose, revealing gaps, deterioration or prior water-management details that were concealed.',
          'The term should still be defined in the quotation. Wood jambs, metal or vinyl frames, masonry openings, siding, exterior capping and built-up trim create different removal and rebuilding scopes. “Full frame” does not say which casing, jamb, sill or exterior finish is included.'
        ],
        cards: [
          { title: 'Removed', text: 'The existing sash and main frame are removed to create a broader installation opening.' },
          { title: 'Exposed', text: 'More of the sill, perimeter substrate, insulation space and prior water-management connection can be inspected.' },
          { title: 'Rebuilt or finished', text: 'Interior jambs, casing, exterior brickmould, capping or cladding returns may need modification or replacement.' }
        ]
      },
      {
        id: 'when-preferable', eyebrow: 'Suitable conditions', title: 'When full-frame replacement is often preferable.',
        paragraphs: [
          'A deteriorated, distorted or poorly integrated existing frame is a strong reason not to build a new installation around it. Full-frame work can also preserve more glass area than placing a new frame inside the old one, although the final sightline depends on both old and new profiles.',
          'The method may support a changed window style, revised combination or coordinated exterior renovation. Structural opening changes are separate work requiring their own assessment; removing the old frame does not by itself authorize changing the wall.'
        ],
        cards: [
          { title: 'Frame deterioration', text: 'The existing frame has rot, corrosion, distortion or other conditions that make retention unreliable.' },
          { title: 'Perimeter access', text: 'The project needs direct access to insulation gaps, substrate or prior water-management details.' },
          { title: 'Opening goals', text: 'An insert would reduce the clear opening unacceptably or the configuration changes within the existing rough opening.' },
          { title: 'Coordinated finishes', text: 'Interior trim, exterior cladding or capping is already being replaced, making the broader scope practical.' }
        ]
      },
      {
        id: 'tradeoffs', eyebrow: 'Advantages and tradeoffs', title: 'Broader access comes with broader work.',
        paragraphs: [
          'The main advantage is access: the installer can assess more of the opening and establish new frame-to-wall connections. The tradeoffs are time, cost, disruption and finish complexity. Removing more material creates more interfaces that must be rebuilt properly.',
          'Full-frame removal can reveal necessary work that could not be priced with certainty beforehand. A useful quotation explains allowances, exclusions or the approval process for repairs instead of pretending every hidden condition is included in one assumption.'
        ],
        table: { caption: 'Full-frame replacement considerations', columns: ['Consideration', 'Typical implication'], rows: [
          ['Rough-opening visibility', 'More of the sill, substrate and perimeter becomes visible after removal.'],
          ['Glass and clear opening', 'May preserve more opening than an insert, subject to the new frame profile.'],
          ['Interior finish', 'Jamb extensions, casing, drywall or other returns may need work.'],
          ['Exterior finish', 'Brickmould, capping, sealant joints, siding or masonry interfaces may be affected.'],
          ['Disruption', 'Usually more removal, preparation and finishing than an insert installation.'],
          ['Relative cost', 'Commonly higher because labour, materials and concealed-condition exposure are greater.']
        ] }
      },
      {
        id: 'quote', eyebrow: 'Written scope', title: 'The quotation should define the finish boundary.',
        paragraphs: [
          'Confirm whether casing will be removed and replaced, whether jamb extensions are included, how exterior brickmould or capping will be handled and what paint or touch-up work is excluded. The scope should state removal, disposal, insulation, air sealing and exterior water management.',
          'If visible evidence suggests damage, ask how investigation and repair will be documented. The answer may be an allowance, a unit rate, a separate repair quotation or an approval step after removal.'
        ],
        callout: { title: 'Full-frame is a scope, not a slogan', text: 'Its value comes from removing an unsuitable frame and rebuilding the connection properly. Select it from opening condition and project goals, not as a universal upgrade.' }
      }
    ],
    productReferences: ['WRP-W002', 'WRP-W004', 'WRP-W008'],
    relatedLinks: [
      { title: 'Retrofit replacement', description: 'Understand what changes when the existing frame stays.', href: '/window-replacement/retrofit/' },
      { title: 'Full-frame vs retrofit', description: 'Compare the methods in a single decision table.', href: '/guides/full-frame-vs-retrofit-windows/' },
      { title: 'Window installation', description: 'Review the complete professional installation sequence.', href: '/window-installation/' },
      { title: 'Window replacement cost', description: 'See how installation scope affects quotation structure.', href: '/window-replacement-cost/' }
    ],
    heroReference: 'WRP-W002', visualReferences: ['WRP-W004', 'WRP-W008'], technicalMediaKeys: ['window-deep-frame-profile'],
    visualGap: 'No verified public-safe rough-opening or flashing sequence is available, so the profile visual is captioned as product construction rather than an installation diagram.'
  },
  {
    path: '/window-replacement/retrofit/', kind: 'service', cluster: 'windows', eyebrow: 'Installation method',
    title: 'Retrofit and insert window replacement explained.',
    metaTitle: 'Retrofit Window Replacement | Window Replacement Pro',
    metaDescription: 'Learn what retrofit window replacement retains, how insert sizing affects the opening, when the method is reasonable and when full-frame work may be preferable.',
    lead: 'Retrofit or insert replacement generally places a new window within a serviceable existing frame. It can reduce removal and finish work, but its success depends on the condition, geometry and water management of everything that remains.',
    intro: [
      'The existing sash and selected components are removed while the main perimeter frame stays in place. The new unit is sized to fit inside that retained structure. Terminology varies, so the quotation should identify exactly which frame, jamb, sill, trim and exterior materials remain.',
      'An insert is not a repair for a deteriorated frame. It is a replacement method built around a frame assessed as suitable to keep. Where that assumption is sound, the method can reduce disturbance to adjacent finishes.'
    ],
    highlights: ['Existing main frame generally retained', 'New unit fits inside the retained opening', 'Less finish disturbance in suitable conditions', 'Frame condition and reduced clear opening require review'],
    breadcrumbs: [{ label: 'Window replacement', href: '/window-replacement/' }],
    sections: [
      {
        id: 'what-remains', eyebrow: 'Retained components', title: 'What remains and what changes in a retrofit installation.',
        paragraphs: [
          'The operating sash, glass and selected stops or trim are removed to create a receiving opening. The main old frame remains connected to the wall, and the new frame occupies part of the area previously available to sash and glass.',
          'The scope must describe the actual boundary. A homeowner should know whether old wood jambs remain visible, whether exterior capping is reused or replaced, and how the new frame will be insulated and sealed to the retained one.'
        ],
        cards: [
          { title: 'Usually removed', text: 'Existing sash, glass, operating hardware and components needed to create a stable insert opening.' },
          { title: 'Usually retained', text: 'The main perimeter frame and connected finishes when their condition supports reuse.' },
          { title: 'New work', text: 'A manufactured window unit, perimeter support, insulation and sealing, plus quoted transition trim or capping.' }
        ]
      },
      {
        id: 'reasonable', eyebrow: 'Suitable conditions', title: 'When retrofit replacement can be reasonable.',
        paragraphs: [
          'The retained frame should be dry, stable, integrated with the wall and suitable for fastening and sealing. Its dimensions must leave a useful opening after the insert frame is added. Existing drainage problems or unexplained leakage require investigation first.',
          'The method is attractive where casing, wall finishes and exterior materials are in good condition and minimizing disturbance has value. Installation can be faster than comparable full-frame work, although schedule alone should not override condition.'
        ],
        cards: [
          { title: 'Sound existing frame', text: 'No deterioration, distortion or unresolved water-management concern that would undermine the installation.' },
          { title: 'Acceptable opening reduction', text: 'The new frame leaves practical glass area, clear opening and egress conditions.' },
          { title: 'Finishes worth retaining', text: 'Interior and exterior finishes can remain without compromising the connection.' },
          { title: 'Compatible configuration', text: 'The selected operating style and frame depth can be used properly within the retained opening.' }
        ]
      },
      {
        id: 'tradeoffs', eyebrow: 'Practical tradeoffs', title: 'Reduced disturbance also means reduced access.',
        paragraphs: [
          'An insert can preserve trim and shorten removal, but it does not expose the complete rough opening. Conditions behind the retained frame remain hidden. The new frame also reduces the clear opening to some degree, with the effect determined by both profiles.',
          'Finishing may still be required. Interior transition trim, exterior capping or sealant details must bridge old and new materials cleanly. Retrofit does not mean simply applying sealant around a unit that happens to fit.'
        ],
        table: { caption: 'Retrofit replacement considerations', columns: ['Consideration', 'Typical implication'], rows: [
          ['Existing frame', 'Retained and required to be sound, stable and suitable for sealing.'],
          ['Clear opening', 'Usually reduced because the new frame sits inside the old frame.'],
          ['Rough-opening access', 'Limited; concealed perimeter conditions are not fully visible.'],
          ['Interior finish', 'Often less disruptive, though transition trim or jamb work may remain.'],
          ['Exterior finish', 'Existing capping or returns may remain, be modified or be replaced as quoted.'],
          ['Installation time', 'Often shorter where retained conditions are straightforward and suitable.']
        ] }
      },
      {
        id: 'when-not', eyebrow: 'Method selection', title: 'When full-frame work may be preferable.',
        paragraphs: [
          'Consider full-frame replacement when the old frame is deteriorated, distorted or associated with unresolved leakage; when an insert would reduce the opening too much; when hidden perimeter conditions need direct access; or when finish renovations make frame removal practical.',
          'The decision can vary between openings on the same home. A project can use different methods where conditions justify them, provided each opening and finish scope is identified.'
        ],
        callout: { title: 'Do not choose from speed alone', text: 'Retrofit is appropriate when the retained frame is worth retaining. Full-frame is appropriate when the project needs the old frame removed. Assessment should decide.' }
      }
    ],
    productReferences: ['WRP-W001', 'WRP-W003', 'WRP-W006'],
    relatedLinks: [
      { title: 'Full-frame replacement', description: 'Review the broader removal and finish scope.', href: '/window-replacement/full-frame/' },
      { title: 'Full-frame vs retrofit', description: 'Compare the methods condition by condition.', href: '/guides/full-frame-vs-retrofit-windows/' },
      { title: 'Window installation', description: 'Understand setting, sealing, water management and handoff.', href: '/window-installation/' },
      { title: 'Window replacement cost', description: 'See how retained and replaced components affect cost.', href: '/window-replacement-cost/' }
    ],
    heroReference: 'WRP-W006', visualReferences: ['WRP-W001', 'WRP-W003'], technicalMediaKeys: ['window-slider-profile'],
    visualGap: 'No verified public-safe insert-installation cutaway is available; the technical image shows a window profile only and is not presented as a wall connection.'
  }
];

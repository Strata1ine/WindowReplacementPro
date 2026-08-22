// Public-safe showroom types and media helpers. Confidential source mappings live under src/data/internal.
import { generatedPublicProductShowrooms } from './public-product-showroom-generated.ts';
export type PublicShowroomMedia = {
  key: string;
  alt: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  widths: number[];
  format?: 'webp' | 'jpg';
};

export type PublicShowroomDiagram = {
  kind: 'entry-door' | 'door-glass' | 'patio-door' | 'window';
  variant: string;
  ariaLabel: string;
};

export type PublicShowroomOption = {
  id: string;
  label: string;
  description: string;
  availabilityNote: string;
  media?: PublicShowroomMedia;
  diagram?: PublicShowroomDiagram;
};

export type PublicShowroomGroup = {
  id: 'style' | 'glass' | 'finish' | 'layout' | 'hardware';
  eyebrow: string;
  title: string;
  description: string;
  options: PublicShowroomOption[];
};

export type PublicProductShowroom = {
  publicReference: string;
  gallery: PublicShowroomMedia[];
  groups: PublicShowroomGroup[];
  technicalMedia: PublicShowroomOption[];
  verifiedDetails: { label: string; value: string }[];
  privacyIndicator?: {
    value: number;
    max: 5;
    label: 'Low' | 'Medium' | 'High';
    note: string;
  };
};

export const buildShowroomMedia = (reference: string, media: PublicShowroomMedia) => {
  const largestWidth = Math.max(...media.widths);
  const extension = media.format ?? 'webp';
  const base = '/media/products/' + reference.toLowerCase() + '/' + media.key;
  return {
    src: base + '-' + largestWidth + '.' + extension,
    srcset: media.widths.map(width => base + '-' + width + '.' + extension + ' ' + width + 'w').join(', '),
    width: largestWidth,
    height: Math.round(largestWidth * media.intrinsicHeight / media.intrinsicWidth),
    alt: media.alt
  };
};
const oakMedia = {
  twoPanel: { key: 'style-two-panel', alt: 'Oak-grain fiberglass door with two recessed panels', intrinsicWidth: 500, intrinsicHeight: 1121, widths: [240, 480] },
  threePanel: { key: 'style-three-panel', alt: 'Oak-grain fiberglass door with three arched panels', intrinsicWidth: 500, intrinsicHeight: 1121, widths: [240, 480] },
  fourPanel: { key: 'style-four-panel', alt: 'Oak-grain fiberglass door with four recessed panels', intrinsicWidth: 534, intrinsicHeight: 1200, widths: [240, 480] },
  sixPanel: { key: 'style-six-panel', alt: 'Oak-grain fiberglass door with six traditional panels', intrinsicWidth: 534, intrinsicHeight: 1200, widths: [240, 480] },
  plank: { key: 'style-vertical-plank', alt: 'Oak-grain fiberglass door with a vertical plank appearance', intrinsicWidth: 537, intrinsicHeight: 1200, widths: [240, 480] },
  halfLite: { key: 'glass-half-lite', alt: 'Oak-grain fiberglass door with a half-height glass opening', intrinsicWidth: 530, intrinsicHeight: 1200, widths: [240, 480] },
  threeQuarterLite: { key: 'glass-three-quarter-lite', alt: 'Oak-grain fiberglass door with a three-quarter-height glass opening', intrinsicWidth: 534, intrinsicHeight: 1200, widths: [240, 480] },
  narrowLite: { key: 'glass-narrow-lite', alt: 'Oak-grain fiberglass door with a narrow vertical glass opening', intrinsicWidth: 530, intrinsicHeight: 1200, widths: [240, 480] },
  reededLite: { key: 'glass-reeded-lite', alt: 'Oak-grain fiberglass door with a narrow reeded-glass opening', intrinsicWidth: 720, intrinsicHeight: 1594, widths: [240, 480] },
  grainDetail: { key: 'grain-closeup', alt: 'Close view of an oak-style fiberglass grain texture', intrinsicWidth: 349, intrinsicHeight: 800, widths: [240, 320] },
  oakSwatch: { key: 'finish-oak-texture', alt: 'Oak-style textured fiberglass surface swatch', intrinsicWidth: 180, intrinsicHeight: 180, widths: [180] }
} satisfies Record<string, PublicShowroomMedia>;

const option = (id: string, label: string, description: string, availabilityNote: string, media: PublicShowroomMedia): PublicShowroomOption => ({ id, label, description, availabilityNote, media });

const curatedPublicProductShowrooms: PublicProductShowroom[] = [
  {
    publicReference: 'WRP-D003',
    gallery: [oakMedia.grainDetail, oakMedia.twoPanel, oakMedia.sixPanel, oakMedia.halfLite],
    groups: [
      {
        id: 'style', eyebrow: 'Door style', title: 'Choose an oak-grain panel direction.',
        description: 'These verified slab views show how the same oak-style surface can move from quiet and minimal to strongly traditional. Availability depends on slab size and the complete entrance specification.',
        options: [
          option('two-panel', 'Two-panel', 'Two large recessed panels create a balanced, familiar entrance.', 'Available on selected oak-grain slab sizes.', oakMedia.twoPanel),
          option('three-panel', 'Three-panel arch', 'A curved upper panel adds a softer traditional profile.', 'Confirm the panel embossment for the required slab size.', oakMedia.threePanel),
          option('four-panel', 'Four-panel', 'Four rectangular panels create more vertical rhythm without adding glass.', 'Available in selected slab dimensions.', oakMedia.fourPanel),
          option('six-panel', 'Six-panel', 'A classic six-panel arrangement gives the strongest traditional character.', 'Panel proportions vary with slab height and width.', oakMedia.sixPanel),
          option('vertical-plank', 'Vertical plank', 'Long vertical grain lines create a simpler craftsman or rustic direction.', 'Offered on selected woodgrain slab constructions.', oakMedia.plank)
        ]
      },
      {
        id: 'glass', eyebrow: 'Glass configurations', title: 'Add daylight without losing the oak-grain character.',
        description: 'Glass changes both the amount of daylight and the amount of visible woodgrain. These are verified slab configurations, not universally interchangeable cut-outs.',
        options: [
          option('half-lite', 'Half glass', 'A mid-height glass opening leaves a substantial panelled section below.', 'Glass design and privacy level are selected separately.', oakMedia.halfLite),
          option('three-quarter-lite', 'Three-quarter glass', 'A taller opening brings in more daylight while retaining a lower oak-grain panel.', 'Confirm glass size and compatible slab construction.', oakMedia.threeQuarterLite),
          option('narrow-lite', 'Narrow glass', 'A slim vertical lite adds controlled daylight and preserves more of the textured slab.', 'Available only with compatible narrow-lite preparations.', oakMedia.narrowLite),
          option('reeded-lite', 'Narrow reeded glass', 'Vertical reeded glass reinforces the door height and softens direct views.', 'Texture, privacy and slab compatibility are confirmed together.', oakMedia.reededLite)
        ]
      },
      {
        id: 'finish', eyebrow: 'Surface and finish', title: 'Oak grain up close.',
        description: 'The moulded grain supplies the wood-like texture. The final paint or stain direction is selected with the complete door, frame and exterior palette.',
        options: [
          option('grain-detail', 'Moulded grain detail', 'A high-resolution close view shows the irregular lines that create the oak-style appearance.', 'Final colour and sheen alter how strongly the grain reads.', oakMedia.grainDetail),
          option('oak-texture', 'Oak texture reference', 'A verified surface swatch provides a compact reference for the oak-grain direction.', 'Use a current physical finish sample when one is available.', oakMedia.oakSwatch)
        ]
      }
    ],
    technicalMedia: [],
    verifiedDetails: [
      { label: 'Documented surface', value: 'Textured oak-style fiberglass grain' },
      { label: 'Documented construction', value: 'Fiberglass slab with an insulated core available on selected configurations' },
      { label: 'Documented width examples', value: 'Common residential widths including 32, 34 and 36 in are supported by one mapped construction' }
    ]
  }
];

export const publicProductShowroomData: PublicProductShowroom[] = [
  ...curatedPublicProductShowrooms,
  ...(generatedPublicProductShowrooms as PublicProductShowroom[])
];

export const publicProductShowroomByReference = new Map(publicProductShowroomData.map(showroom => [showroom.publicReference, showroom]));

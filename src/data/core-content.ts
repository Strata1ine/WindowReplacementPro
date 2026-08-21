import { windowProjectPages } from './core-content/window-project-pages';
import { windowMethodPages } from './core-content/window-method-pages';
import { pricingPages } from './core-content/pricing-pages';
import { windowGuidePages } from './core-content/window-guide-pages';
import { windowEducationPages } from './core-content/window-education-pages';
import { doorPatioGuidePages } from './core-content/door-patio-guide-pages';

export type CoreContentCard = {
  title: string;
  text: string;
  points?: string[];
};

export type CoreContentTable = {
  caption: string;
  columns: string[];
  rows: string[][];
};

export type CoreContentSection = {
  id: string;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  cards?: CoreContentCard[];
  steps?: CoreContentCard[];
  table?: CoreContentTable;
  callout?: CoreContentCard;
};

export type CoreContentPage = {
  path: string;
  kind: 'service' | 'guide';
  cluster: 'windows' | 'doors' | 'patio';
  eyebrow: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  lead: string;
  intro: string[];
  highlights: string[];
  breadcrumbs: { label: string; href: string }[];
  sections: CoreContentSection[];
  productReferences: string[];
  relatedLinks: { title: string; description: string; href: string }[];
  heroReference: string;
  visualReferences: string[];
  technicalMediaKeys: string[];
  visualGap?: string;
  diagram?: 'replacement-methods' | 'double-triple' | 'whole-window';
};

export const coreContentPages: CoreContentPage[] = [
  ...windowProjectPages,
  ...windowMethodPages,
  ...pricingPages,
  ...windowGuidePages,
  ...windowEducationPages,
  ...doorPatioGuidePages
];

const paths = coreContentPages.map(page => page.path);
if (new Set(paths).size !== paths.length) throw new TypeError('Duplicate core-content path');

export const coreContentByPath = Object.fromEntries(coreContentPages.map(page => [page.path, page]));
export const coreGuidePages = coreContentPages.filter(page => page.path.startsWith('/guides/'));

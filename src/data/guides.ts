export type Guide = {
  slug: string;
  title: string;
  description: string;
  publishable: boolean;
};

export const guides: Guide[] = [
  { slug: 'window-replacement-cost', title: 'Window Replacement Cost in Ontario', description: 'A practical framework for understanding installed window replacement pricing in Ontario.', publishable: false },
  { slug: 'full-frame-vs-retrofit', title: 'Full-Frame vs Retrofit Window Replacement', description: 'Understand the difference between full-frame and retrofit replacement before choosing an installation approach.', publishable: false },
  { slug: 'double-vs-triple-pane', title: 'Double vs Triple Pane Windows', description: 'Compare double and triple glazing for comfort, efficiency, weight and cost.', publishable: false },
  { slug: 'window-condensation', title: 'Window Condensation Explained', description: 'Understand interior condensation, exterior condensation and failed insulated glass units.', publishable: false }
];

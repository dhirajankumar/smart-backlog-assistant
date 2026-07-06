export const CATEGORIES = [
  'Core Workflow',
  'Data Management',
  'Compliance',
  'Reporting',
  'User Experience',
  'Integration',
] as const;

export type Category = typeof CATEGORIES[number];

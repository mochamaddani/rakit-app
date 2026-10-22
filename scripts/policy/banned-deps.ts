// PRD AC3: the editor engine, drag and drop, and the carousel are built in-house.
// Entries ending in `*` match by prefix; all others must match exactly. Keep in sync with docs/PLAN.md §7.
export const BANNED_DEPENDENCIES: readonly string[] = [
  // Page builders
  'grapesjs*',
  '@grapesjs/*',
  '@craftjs/*',
  '@measured/puck',
  '@puckeditor/*',
  '@builder.io/*',
  '@webstudio-is/*',
  // Drag and drop
  '@dnd-kit/*',
  'react-dnd*',
  'react-beautiful-dnd',
  '@hello-pangea/dnd',
  'sortablejs',
  'react-sortablejs',
  'dragula',
  'react-dragula',
  'interactjs',
  '@atlaskit/pragmatic-drag-and-drop*',
  'react-grid-layout',
  // Carousels
  'swiper',
  'keen-slider',
  'embla-carousel*',
  'slick-carousel',
  'react-slick',
  'flickity',
  '@glidejs/glide',
  '@splidejs/*',
];

interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function matches(name: string, pattern: string): boolean {
  return pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern;
}

export function findBannedDependencies(pkg: PackageManifest): string[] {
  const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  const banned = names.filter((name) =>
    BANNED_DEPENDENCIES.some((pattern) => matches(name, pattern)),
  );
  return [...new Set(banned)].sort();
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findBannedDependencies } from '@/scripts/policy/banned-deps';

describe('dependency policy (PRD AC3: no page-builder, DnD or carousel frameworks)', () => {
  it('flags banned packages, including scoped families and prefixes', () => {
    expect(
      findBannedDependencies({
        dependencies: {
          grapesjs: '1',
          react: '19',
          '@dnd-kit/core': '6',
          'grapesjs-preset-webpage': '1',
        },
        devDependencies: { '@builder.io/sdk': '1', 'embla-carousel-react': '8', zod: '4' },
      }),
    ).toEqual([
      '@builder.io/sdk',
      '@dnd-kit/core',
      'embla-carousel-react',
      'grapesjs',
      'grapesjs-preset-webpage',
    ]);
  });

  it('package.json contains no banned dependency', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(findBannedDependencies(pkg)).toEqual([]);
  });
});

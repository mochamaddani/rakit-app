import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAssets } from '@/scripts/build-assets';

describe('buildAssets', () => {
  it('minifies CSS and wraps snippets in an IIFE', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'assets-'));
    mkdirSync(join(dir, 'lib/x'), { recursive: true });
    mkdirSync(join(dir, 'lib/y'), { recursive: true });
    writeFileSync(join(dir, 'lib/x/styles.css'), 'a { color : red; }\n');
    writeFileSync(join(dir, 'lib/y/snippet.js'), 'var a = 1;\nwindow.x = a;\n');
    const out = await buildAssets(dir);
    const css = out.find((o) => o.outputPath.endsWith(join('lib', 'x', 'styles.generated.ts')))!;
    expect(css.contents).toContain('min: "a{color:red}"');
    const js = out.find((o) => o.outputPath.endsWith(join('lib', 'y', 'snippet.generated.ts')))!;
    expect(js.contents).toMatch(/min: "\(\(\)=>\{/);
  });

  it('every committed generated asset is up to date (run `pnpm assets` if this fails)', async () => {
    const outputs = await buildAssets(process.cwd());
    expect(outputs.length).toBeGreaterThan(0);
    for (const o of outputs)
      expect(readFileSync(o.outputPath, 'utf8'), o.outputPath).toBe(o.contents);
  });
});

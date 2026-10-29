import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { main } from '@/scripts/render';

describe('render CLI', () => {
  it('renders the example document to a self-contained file', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'render-')), 'example.html');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await main(['--out', out])).toBe(0);
    expect(readFileSync(out, 'utf8').startsWith('<!doctype html><html lang="id">')).toBe(true);
  });
  it('fails with readable validation issues for an invalid document', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'render-'));
    const bad = join(dir, 'bad.json');
    writeFileSync(
      bad,
      JSON.stringify({
        schemaVersion: 2,
        sections: [{ id: 's', blocks: [{ id: 'b', type: 'hero', props: {} }] }],
      }),
    );
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((m: unknown) => void errors.push(String(m)));
    expect(await main([bad, '--out', join(dir, 'x.html')])).toBe(1);
    expect(errors.join('\n')).toContain('sections.0.blocks.0.props.headline');
  });
  it('rejects an unknown mode as a usage error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main(['--mode', 'pdf'])).toBe(2);
  });
});

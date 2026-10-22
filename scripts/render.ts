// Renders a PageDocument to one self-contained HTML file (PRD §10 M1).
// Usage: pnpm render [document.json] [--out <file>] [--mode export|preview] [--no-minify]
// Without a document it renders the built-in example to out/example.html.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { renderPage } from '@/lib/renderer/page';
import { safeParseDocument } from '@/lib/schema/document';
import { exampleDocument } from '@/tests/fixtures/example-document';

const USAGE =
  'Usage: pnpm render [document.json] [--out <file>] [--mode export|preview] [--no-minify]';
const kb = (bytes: number) => (bytes / 1024).toFixed(1);

/** Exit codes: 0 rendered, 1 invalid document, 2 usage or read error. */
export async function main(argv: string[]): Promise<number> {
  let args: ReturnType<typeof parseCli>;
  try {
    args = parseCli(argv);
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = args;
  const mode = values.mode;
  if (mode !== 'export' && mode !== 'preview') {
    console.error(`Unknown --mode "${mode}".\n${USAGE}`);
    return 2;
  }
  if (positionals.length > 1) {
    console.error(USAGE);
    return 2;
  }

  const input = positionals[0];
  let raw: unknown;
  try {
    raw = input ? JSON.parse(readFileSync(input, 'utf8')) : exampleDocument;
  } catch (error) {
    console.error(
      `Cannot read ${input}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }

  const result = safeParseDocument(raw);
  if (!result.ok) {
    for (const issue of result.error.issues)
      console.error(`${issue.path || '(root)'}: ${issue.message}`);
    return 1;
  }

  const out =
    values.out ?? join('out', `${input ? basename(input, extname(input)) : 'example'}.html`);
  const rendered = renderPage(result.doc, { mode, minify: !values['no-minify'] });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, rendered.html);

  console.log(
    `Wrote ${out} (${kb(rendered.bytes)} KB; CSS ${kb(rendered.cssBytes)} KB, JS ${kb(rendered.jsBytes)} KB)`,
  );
  for (const block of rendered.blocks) {
    console.log(`  ${block.blockId.padEnd(16)} ${block.type.padEnd(18)} ${kb(block.bytes)} KB`);
  }
  for (const warning of rendered.warnings) console.error(`warning: ${warning}`);
  return 0;
}

function parseCli(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      mode: { type: 'string', default: 'export' },
      'no-minify': { type: 'boolean', default: false },
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

import { HtmlValidate } from 'html-validate';

const validator = new HtmlValidate({
  extends: ['html-validate:recommended'],
  rules: {
    // Per-instance block options travel as CSS custom properties in style attributes (D-012).
    'no-inline-style': 'off',
    // The renderer's document skeleton uses a lowercase doctype; enforce that style consistently.
    'doctype-style': ['error', { style: 'lowercase' }],
  },
});

/** Returns "<ruleId>: <message> (<line>:<col>)" for every problem; [] means valid. */
export async function validateHtml(markup: string): Promise<string[]> {
  const report = await validator.validateString(markup);
  return report.results.flatMap((result) =>
    result.messages.map((m) => `${m.ruleId}: ${m.message} (${m.line}:${m.column})`),
  );
}

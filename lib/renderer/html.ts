// All renderer markup is built with the `html` tag: interpolated values are escaped unless they are
// already SafeHtml (docs/DECISIONS.md D-010). Concatenating SafeHtml into a plain string loses the
// marker, so the result gets escaped again — a visible bug instead of an injection.

export class SafeHtml {
  constructor(readonly value: string) {}

  toString(): string {
    return this.value;
  }
}

export type HtmlValue =
  SafeHtml | string | number | boolean | null | undefined | readonly HtmlValue[];

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ENTITIES[ch] ?? ch);
}

function isValueList(value: HtmlValue): value is readonly HtmlValue[] {
  return Array.isArray(value);
}

function serialize(value: HtmlValue): string {
  if (value instanceof SafeHtml) return value.value;
  if (isValueList(value)) return value.map(serialize).join('');
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return escapeHtml(String(value));
}

export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): SafeHtml {
  let out = strings[0] ?? '';
  values.forEach((value, i) => {
    out += serialize(value) + (strings[i + 1] ?? '');
  });
  return new SafeHtml(out);
}

/**
 * Only for our own generated CSS/JS and icon SVG constants, and for owner code that runs in export
 * only (custom head/body code, Form Embed snippets; M4 adds the Custom HTML block).
 */
export function unsafeRaw(markup: string): SafeHtml {
  return new SafeHtml(markup);
}

const utf8 = new TextEncoder();

export function byteLength(text: string): number {
  return utf8.encode(text).byteLength;
}

/** Keeps inline <script> content from closing its own element or opening an HTML comment. */
export function escapeInlineScript(code: string): string {
  return code.replace(/<\/script/gi, (m) => `<\\/${m.slice(2)}`).replace(/<!--/g, '<\\!--');
}

/** Keeps inline <style> content from closing its own element. */
export function escapeInlineStyle(css: string): string {
  return css.replace(/<\/style/gi, (m) => `<\\/${m.slice(2)}`);
}

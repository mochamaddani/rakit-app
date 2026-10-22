import { describe, expect, it } from 'vitest';
import { serializeInline, serializeText } from './inline-serialize';

describe('serializeInline', () => {
  it('drops redundant escapes and unsafe links', () => {
    expect(serializeInline([{ t: 'text', v: 'a\\b' }])).toBe('a\\b');
    expect(
      serializeInline([{ t: 'link', href: 'javascript:alert(1)', label: [{ t: 'text', v: 'x' }] }]),
    ).toBe('x');
  });

  it('keeps escapes that stop text from reading as markup', () => {
    expect(serializeInline([{ t: 'text', v: '*a*' }])).toBe('\\*a*');
    expect(serializeInline([{ t: 'text', v: '[x](https://x.example/)' }])).toBe(
      '\\[x](https://x.example/)',
    );
  });

  it('moves spaces out of marks, and writes marks it cannot express as text', () => {
    expect(
      serializeInline([
        { t: 'text', v: 'a' },
        { t: 'strong', v: ' b ' },
      ]),
    ).toBe('a **b** ');
    expect(serializeInline([{ t: 'em', v: '   ' }])).toBe('   ');
    expect(serializeInline([{ t: 'em', v: 'a*b' }])).toBe('a*b');
  });
});

describe('serializeText', () => {
  it('text fields get plain text', () => {
    expect(serializeText([{ t: 'text', v: 'a' }, { t: 'br' }, { t: 'strong', v: 'b' }])).toBe(
      'a b',
    );
  });
});

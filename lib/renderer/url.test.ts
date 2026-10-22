import { describe, expect, it } from 'vitest';
import { sanitizeUrl } from '@/lib/renderer/url';

describe('sanitizeUrl', () => {
  it.each([
    ['https://example.com/a?b=1#c', 'link', 'https://example.com/a?b=1#c'],
    ['http://example.com', 'link', 'http://example.com'],
    ['mailto:hi@example.com', 'link', 'mailto:hi@example.com'],
    ['tel:+62812345', 'link', 'tel:+62812345'],
    ['sms:+62812345', 'link', 'sms:+62812345'],
    ['#order', 'link', '#order'],
    ['/thanks', 'link', '/thanks'],
    ['  https://example.com  ', 'link', 'https://example.com'],
    ['javascript:alert(1)', 'link', null],
    ['JaVaScRiPt:alert(1)', 'link', null],
    ['java\tscript:alert(1)', 'link', null],
    ['\u0001javascript:alert(1)', 'link', null],
    ['vbscript:x', 'link', null],
    ['data:text/html,<script>', 'link', null],
    ['file:///etc/passwd', 'link', null],
    ['', 'link', null],
    ['https://cdn.example.com/a.webp', 'image', 'https://cdn.example.com/a.webp'],
    ['data:image/webp;base64,UklGR', 'image', 'data:image/webp;base64,UklGR'],
    ['data:image/svg+xml;base64,PHN2Zz4=', 'image', 'data:image/svg+xml;base64,PHN2Zz4='],
    ['data:text/html;base64,PHNjcmlwdD4=', 'image', null],
    ['mailto:x@y.z', 'image', null],
    ['javascript:alert(1)', 'image', null],
  ] as const)('sanitizeUrl(%j, %s) → %j', (input, kind, expected) => {
    expect(sanitizeUrl(input, kind)).toBe(expected);
  });
});

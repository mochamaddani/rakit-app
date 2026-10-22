import { expect, it } from 'vitest';
import { AA_TEXT_RATIO, THEME_CONTRAST_PAIRS, contrastRatio } from './contrast';
import { DEFAULT_THEME } from './theme';

it('computes WCAG contrast ratios', () => {
  expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
  expect(contrastRatio('#FFFFFF', '#FDE047')).toBeCloseTo(1.32, 1);
  expect(contrastRatio('#2563EB', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#2563EB'), 10);
});
it('every default theme pair passes AA for body text', () => {
  for (const [fg, bg] of THEME_CONTRAST_PAIRS)
    expect(
      contrastRatio(DEFAULT_THEME.colors[fg], DEFAULT_THEME.colors[bg]),
      `${fg}/${bg}`,
    ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
});

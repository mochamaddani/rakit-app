import { expect, it } from 'vitest';
import { fieldLabel, optionLabel } from './labels';

it('labels fields from overrides or humanized keys', () => {
  expect(fieldLabel('compareAtPrice')).toBe('Compare-at price');
  expect(fieldLabel('subheadline')).toBe('Subheadline');
  expect(fieldLabel('reviewCount')).toBe('Review count');
  expect(fieldLabel('constructor')).toBe('Constructor');
});
it('labels options from overrides or humanized values', () => {
  expect(optionLabel('hideOn', 'none')).toBe('Never');
  expect(optionLabel('font', 'neo-grotesque')).toBe('Neo-grotesque');
  expect(optionLabel('columns', 3)).toBe('3');
});

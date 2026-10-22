import { FONT_STACKS, RADIUS_PX, type Theme } from '@/lib/schema/theme';

/** Theme tokens as `:root` custom properties, in a fixed order so output stays byte-stable. */
export function themeCss(theme: Theme): string {
  const { colors } = theme;
  const radius = `${RADIUS_PX[theme.radius]}px`;
  const buttonRadius =
    theme.buttonShape === 'pill' ? '999px' : theme.buttonShape === 'square' ? '0px' : radius;
  const tokens: ReadonlyArray<readonly [string, string]> = [
    ['primary', colors.primary],
    ['on-primary', colors.onPrimary],
    ['accent', colors.accent],
    ['on-accent', colors.onAccent],
    ['background', colors.background],
    ['surface', colors.surface],
    ['text', colors.text],
    ['muted', colors.mutedText],
    ['border', colors.border],
    ['dark', colors.dark],
    ['on-dark', colors.onDark],
    ['font', FONT_STACKS[theme.font]],
    ['heading-font', FONT_STACKS[theme.headingFont]],
    ['radius', radius],
    ['btn-radius', buttonRadius],
  ];
  return `:root{${tokens.map(([name, value]) => `--lp-${name}:${value}`).join(';')}}`;
}

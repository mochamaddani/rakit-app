import { z } from 'zod';
import { HexColorSchema } from './primitives';

/** System font stacks from modernfontstacks.com (CC0); exported pages never fetch web fonts by default. */
export const FONT_STACKS = {
  system: 'system-ui, sans-serif',
  humanist:
    "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif",
  geometric: "Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, sans-serif",
  'neo-grotesque':
    "Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial, sans-serif",
  rounded:
    "ui-rounded, 'Hiragino Maru Gothic ProN', Quicksand, Comfortaa, Manjari, 'Arial Rounded MT', 'Arial Rounded MT Bold', Calibri, source-sans-pro, sans-serif",
  transitional: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif",
  'old-style': "'Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', P052, serif",
} as const;
export type FontStackId = keyof typeof FONT_STACKS;
const FontStackIdSchema = z.enum(Object.keys(FONT_STACKS) as [FontStackId, ...FontStackId[]]);

export const RADIUS_PX = { none: 0, sm: 4, md: 8, lg: 14, xl: 22 } as const;
type RadiusId = keyof typeof RADIUS_PX;

export const ThemeSchema = z.object({
  colors: z.object({
    primary: HexColorSchema,
    onPrimary: HexColorSchema,
    accent: HexColorSchema,
    onAccent: HexColorSchema,
    background: HexColorSchema,
    surface: HexColorSchema,
    text: HexColorSchema,
    mutedText: HexColorSchema,
    border: HexColorSchema,
    dark: HexColorSchema,
    onDark: HexColorSchema,
  }),
  font: FontStackIdSchema,
  headingFont: FontStackIdSchema,
  radius: z.enum(Object.keys(RADIUS_PX) as [RadiusId, ...RadiusId[]]),
  buttonShape: z.enum(['rounded', 'pill', 'square']),
});
export type Theme = z.output<typeof ThemeSchema>;

export const DEFAULT_THEME: Theme = {
  colors: {
    primary: '#2563EB',
    onPrimary: '#FFFFFF',
    accent: '#F59E0B',
    onAccent: '#111827',
    background: '#FFFFFF',
    surface: '#F3F4F6',
    text: '#111827',
    mutedText: '#4B5563',
    border: '#E5E7EB',
    dark: '#111827',
    onDark: '#F9FAFB',
  },
  font: 'system',
  headingFont: 'system',
  radius: 'md',
  buttonShape: 'rounded',
};

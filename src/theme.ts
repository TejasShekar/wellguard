import { useColorScheme } from 'react-native';

/**
 * Minimal-mono design tokens. The palette is deliberately near-greyscale — the
 * only "color" is the contrast between ink and paper, inverted for dark mode.
 * A single restrained red is reserved strictly for destructive affordances,
 * where pure mono would hurt legibility of stop/remove actions.
 */
export type Palette = {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  fill: string; // primary action fill (ink)
  onFill: string; // text/icon on top of fill (paper)
  fillMuted: string; // inactive / secondary surface
  danger: string;
};

const light: Palette = {
  scheme: 'light',
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f4f4f5',
  border: '#e4e4e7',
  text: '#09090b',
  textMuted: '#52525b',
  textFaint: '#a1a1aa',
  fill: '#09090b',
  onFill: '#ffffff',
  fillMuted: '#e4e4e7',
  danger: '#b91c1c',
};

const dark: Palette = {
  scheme: 'dark',
  bg: '#09090b',
  surface: '#161618',
  surfaceAlt: '#1f1f23',
  border: '#2a2a30',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textFaint: '#71717a',
  fill: '#fafafa',
  onFill: '#09090b',
  fillMuted: '#2a2a30',
  danger: '#f87171',
};

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const type = {
  display: 28,
  title: 20,
  body: 15,
  label: 12,
  mono: 12,
} as const;

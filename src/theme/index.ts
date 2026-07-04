import { useColorScheme } from 'react-native';

import { dark, light, type Palette } from './colors';
import { radius, shadow, spacing, typography } from './tokens';

export interface Theme {
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadow: typeof shadow;
  isDark: boolean;
}

const themes: Record<'light' | 'dark', Theme> = {
  light: { colors: light, spacing, radius, typography, shadow, isDark: false },
  dark: { colors: dark, spacing, radius, typography, shadow, isDark: true },
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return themes[scheme === 'dark' ? 'dark' : 'light'];
}

export { radius, shadow, spacing, typography };
export type { Palette };

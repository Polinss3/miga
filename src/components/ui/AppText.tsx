import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme';
import type { typography } from '@/theme/tokens';

interface AppTextProps extends TextProps {
  variant?: keyof typeof typography;
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'onAccent';
}

export function AppText({ variant = 'body', color = 'primary', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const colorValue = {
    primary: theme.colors.text,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    accent: theme.colors.accent,
    danger: theme.colors.danger,
    onAccent: theme.colors.textOnAccent,
  }[color];

  return <Text {...rest} style={[theme.typography[variant], { color: colorValue }, style]} />;
}

import type { PropsWithChildren } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

interface CardProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
}

export function Card({ children, onPress, style, muted }: PropsWithChildren<CardProps>) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: muted ? theme.colors.surfaceMuted : theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: theme.isDark ? 0 : 1,
    borderColor: theme.colors.border,
    ...(!theme.isDark && !muted ? theme.shadow.card : null),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

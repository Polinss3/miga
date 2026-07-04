import { Pressable, StyleSheet, View } from 'react-native';

import { Glass, hasLiquidGlass } from './Glass';
import { Icon, type IconName } from './Icon';

import { useTheme } from '@/theme';

interface GlassIconButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  /** Icon (and glass) tint. Defaults to the accent color. */
  color?: string;
}

/**
 * Circular Liquid Glass icon button for headers/toolbars (iOS 26). Falls back
 * to a subtle translucent circle on older iOS / Expo Go / Android.
 */
export function GlassIconButton({ icon, onPress, accessibilityLabel, size = 22, color }: GlassIconButtonProps) {
  const theme = useTheme();
  const tint = color ?? theme.colors.accent;
  const diameter = size + theme.spacing.md * 2;

  const circle = { width: diameter, height: diameter, borderRadius: diameter / 2 } as const;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [circle, styles.center, { opacity: pressed ? 0.7 : 1, overflow: 'hidden' }]}
    >
      {hasLiquidGlass() ? (
        <Glass variant="clear" interactive style={[StyleSheet.absoluteFill, circle]} />
      ) : (
        <View style={[StyleSheet.absoluteFill, circle, { backgroundColor: theme.colors.surface }]} />
      )}
      <Icon name={icon} size={size} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

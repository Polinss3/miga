import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { Glass, hasLiquidGlass } from './Glass';
import { Icon, type IconName } from './Icon';

import { useTheme } from '@/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isBlocked = disabled || loading;

  const background = {
    primary: theme.colors.accent,
    secondary: theme.colors.accentSoft,
    ghost: 'transparent',
    danger: theme.colors.danger,
  }[variant];
  const foreground = {
    primary: theme.colors.textOnAccent,
    secondary: theme.colors.accent,
    ghost: theme.colors.accent,
    danger: theme.colors.textOnAccent,
  }[variant];
  const heights = { sm: 36, md: 48, lg: 54 } as const;
  const radius = theme.radius.full;
  const paddingHorizontal = size === 'sm' ? theme.spacing.md : theme.spacing.xl;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const inner = loading ? (
    <ActivityIndicator color={foreground} />
  ) : (
    <>
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 19} color={foreground} /> : null}
      <AppText variant={size === 'sm' ? 'subhead' : 'headline'} style={{ color: foreground, fontWeight: '600' }}>
        {label}
      </AppText>
    </>
  );

  // Liquid Glass (iOS 26): tinted glass for primary/danger, clear glass for
  // secondary. Ghost stays a plain text button. Falls back to solid fills on
  // older iOS / Expo Go / Android.
  if (hasLiquidGlass() && variant !== 'ghost') {
    const tint =
      variant === 'primary' ? theme.colors.accent : variant === 'danger' ? theme.colors.danger : undefined;
    return (
      <Pressable
        onPress={handlePress}
        disabled={isBlocked}
        accessibilityRole="button"
        accessibilityState={{ disabled: isBlocked, busy: loading }}
        style={({ pressed }) => [
          styles.glassBase,
          { height: heights[size], borderRadius: radius, opacity: isBlocked ? 0.5 : pressed ? 0.9 : 1 },
          style,
        ]}
      >
        <Glass
          variant={tint ? 'regular' : 'clear'}
          tintColor={tint}
          interactive
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
        <View style={[styles.content, { paddingHorizontal, gap: theme.spacing.sm }]}>{inner}</View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={({ pressed }) => [
        styles.solid,
        {
          backgroundColor: background,
          height: heights[size],
          borderRadius: radius,
          paddingHorizontal,
          opacity: isBlocked ? 0.5 : pressed ? 0.85 : 1,
          gap: theme.spacing.sm,
        },
        style,
      ]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  solid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  glassBase: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

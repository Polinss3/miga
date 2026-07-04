import { BlurView } from 'expo-blur';
import type { ComponentType, PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

interface GlassProps {
  style?: StyleProp<ViewStyle>;
  /** 'regular' frosted glass or 'clear' for near-transparent glass. */
  variant?: 'regular' | 'clear';
  interactive?: boolean;
  /** Optional accent tint blended into the glass (iOS 26 tinted glass). */
  tintColor?: string;
}

type NativeGlassViewProps = PropsWithChildren<{
  glassEffectStyle?: GlassProps['variant'];
  isInteractive?: boolean;
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
}>;

interface GlassEffectModule {
  GlassView: ComponentType<NativeGlassViewProps>;
  isLiquidGlassAvailable: () => boolean;
}

let glassEffectModule: GlassEffectModule | null | undefined;

function loadGlassEffectModule(): GlassEffectModule | null {
  if (glassEffectModule !== undefined) return glassEffectModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module; Expo Go may not include it
    glassEffectModule = require('expo-glass-effect') as GlassEffectModule;
  } catch {
    glassEffectModule = null;
  }
  return glassEffectModule;
}

function getLiquidGlassView(): ComponentType<NativeGlassViewProps> | null {
  if (Platform.OS !== 'ios') return null;
  const mod = loadGlassEffectModule();
  if (!mod) return null;
  try {
    return mod.isLiquidGlassAvailable() ? mod.GlassView : null;
  } catch {
    return null;
  }
}

let liquidGlassAvailable: boolean | undefined;

/** True when native iOS 26 Liquid Glass is available (build only, not Expo Go). */
export function hasLiquidGlass(): boolean {
  // OS capability can't change during a session — resolve once and cache.
  if (liquidGlassAvailable === undefined) liquidGlassAvailable = getLiquidGlassView() != null;
  return liquidGlassAvailable;
}

/**
 * Liquid Glass surface on iOS 26+, blur on older iOS, and a translucent
 * solid surface on Android — one component, best available effect.
 */
export function Glass({
  children,
  style,
  variant = 'regular',
  interactive,
  tintColor,
}: PropsWithChildren<GlassProps>) {
  const theme = useTheme();
  const LiquidGlassView = getLiquidGlassView();

  if (LiquidGlassView) {
    return (
      <LiquidGlassView
        glassEffectStyle={variant}
        isInteractive={interactive}
        tintColor={tintColor}
        style={style}
      >
        {children}
      </LiquidGlassView>
    );
  }
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={variant === 'clear' ? 30 : 60}
        tint={theme.isDark ? 'dark' : 'light'}
        style={[styles.clipped, style]}
      >
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[styles.clipped, { backgroundColor: theme.colors.tabBar }, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  clipped: { overflow: 'hidden' },
});

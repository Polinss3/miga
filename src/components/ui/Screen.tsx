import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

interface ScreenProps {
  /** Scrollable content (default) or a fixed view. */
  scroll?: boolean;
  /** Extra bottom padding so content clears the floating tab bar. */
  padBottom?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  scroll = true,
  padBottom = true,
  style,
  contentStyle,
}: PropsWithChildren<ScreenProps>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = padBottom ? insets.bottom + 96 : theme.spacing.lg;

  if (!scroll) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }, style]}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: theme.colors.background }, style]}
      contentContainerStyle={[
        { padding: theme.spacing.lg, paddingBottom: bottomPad, gap: theme.spacing.lg },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      // Native tabs put this ScrollView inside a UIKit controller, which would
      // otherwise auto-add the top safe-area inset on top of our manual
      // paddingTop (insets.top) — double margin. We inset manually, so disable it.
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

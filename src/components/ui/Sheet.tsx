import type { PropsWithChildren } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { Icon } from './Icon';

import { useTheme } from '@/theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
}

/**
 * Native iOS sheet (UIKit pageSheet): rounded card that slides up over the
 * current screen with the system swipe-down-to-dismiss gesture. On Android it
 * falls back to a full-screen modal. Content scrolls and adjusts for the
 * keyboard automatically.
 */
export function Sheet({ visible, onClose, title, children }: PropsWithChildren<SheetProps>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.sm,
          }}
        >
          <AppText variant="headline" style={{ flex: 1 }} numberOfLines={1}>
            {title ?? ''}
          </AppText>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Icon name="close" size={22} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{
            padding: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.xxl,
            gap: theme.spacing.md,
          }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

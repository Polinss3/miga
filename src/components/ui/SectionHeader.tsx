import { Pressable, View } from 'react-native';

import { AppText } from './AppText';

import { useTheme } from '@/theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginTop: theme.spacing.sm,
      }}
    >
      <AppText variant="title3">{title}</AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <AppText variant="subhead" color="accent" style={{ fontWeight: '600' }}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

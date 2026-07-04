import { View } from 'react-native';

import { AppText } from './AppText';

import { useTheme } from '@/theme';

interface MacroBarProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
  color: string;
}

export function MacroBar({ label, current, target, unit = 'g', color }: MacroBarProps) {
  const theme = useTheme();
  const ratio = target > 0 ? Math.min(current / target, 1) : 0;
  const rounded = Math.round(current);

  return (
    <View style={{ flex: 1, gap: theme.spacing.xs }}>
      <AppText variant="footnote" color="secondary">
        {label}
      </AppText>
      <View
        style={{
          height: 6,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.surfaceMuted,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            borderRadius: theme.radius.full,
            backgroundColor: color,
          }}
        />
      </View>
      <AppText variant="footnote" style={{ fontVariant: ['tabular-nums'] }}>
        {rounded}
        <AppText variant="caption" color="tertiary">
          {' '}
          / {Math.round(target)} {unit}
        </AppText>
      </AppText>
    </View>
  );
}

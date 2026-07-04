import { Pressable } from 'react-native';

import { AppText } from './AppText';

import { useTheme } from '@/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, disabled }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => ({
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.full,
        backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <AppText
        variant="subhead"
        style={{
          color: selected ? theme.colors.textOnAccent : theme.colors.text,
          fontWeight: selected ? '600' : '400',
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { Icon } from './Icon';

import { useTheme } from '@/theme';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Rendered next to the number, e.g. "raciones". */
  suffix?: string;
}

/** Compact −/+ numeric stepper for quantities like servings. */
export function Stepper({ value, onChange, min = 0.5, max = 20, step = 0.5, suffix }: StepperProps) {
  const theme = useTheme();

  const buttonStyle = (disabled: boolean) => ({
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    opacity: disabled ? 0.4 : 1,
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <Pressable
        onPress={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
        disabled={value <= min}
        hitSlop={8}
        accessibilityRole="button"
        style={buttonStyle(value <= min)}
      >
        <Icon name="minus" size={14} color={theme.colors.accent} />
      </Pressable>
      <AppText variant="headline" style={{ minWidth: 34, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
        {value % 1 === 0 ? value : value.toFixed(1)}
      </AppText>
      <Pressable
        onPress={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))}
        disabled={value >= max}
        hitSlop={8}
        accessibilityRole="button"
        style={buttonStyle(value >= max)}
      >
        <Icon name="plus" size={14} color={theme.colors.accent} />
      </Pressable>
      {suffix ? (
        <AppText variant="subhead" color="secondary">
          {suffix}
        </AppText>
      ) : null}
    </View>
  );
}

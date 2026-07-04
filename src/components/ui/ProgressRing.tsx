import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from './AppText';

import { useTheme } from '@/theme';

interface ProgressRingProps {
  /** 0..1 (values above 1 render a full ring in warning color). */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  centerLabel?: string;
  centerCaption?: string;
}

export function ProgressRing({
  progress,
  size = 150,
  strokeWidth = 12,
  color,
  centerLabel,
  centerCaption,
}: ProgressRingProps) {
  const theme = useTheme();
  const over = progress > 1;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const ringColor = over ? theme.colors.warning : (color ?? theme.colors.accent);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.colors.surfaceMuted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {centerLabel ? (
        <AppText variant="title2" style={{ fontVariant: ['tabular-nums'] }}>
          {centerLabel}
        </AppText>
      ) : null}
      {centerCaption ? (
        <AppText variant="footnote" color="secondary">
          {centerCaption}
        </AppText>
      ) : null}
    </View>
  );
}

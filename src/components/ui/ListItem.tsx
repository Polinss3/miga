import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

import { useTheme } from '@/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  iconColor?: string;
  onPress?: () => void;
  chevron?: boolean;
  right?: ReactNode;
  destructive?: boolean;
}

export function ListItem({
  title,
  subtitle,
  value,
  icon,
  iconColor,
  onPress,
  chevron,
  right,
  destructive,
}: ListItemProps) {
  const theme = useTheme();

  const content = (
    <>
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={18} color={iconColor ?? theme.colors.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" color={destructive ? 'danger' : 'primary'} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" color="secondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="subhead" color="secondary" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </AppText>
      ) : null}
      {right}
      {chevron ? <Icon name="chevronRight" size={14} color={theme.colors.textTertiary} /> : null}
    </>
  );

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    minHeight: 52,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [rowStyle, pressed && { opacity: 0.7 }]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{content}</View>;
}

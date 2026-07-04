import { ActivityIndicator, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

import { useTheme } from '@/theme';

interface StateProps {
  title: string;
  message?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}

function CenteredState({ title, message, icon, actionLabel, onAction }: StateProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xxl,
        gap: theme.spacing.md,
        minHeight: 240,
      }}
    >
      {icon ? <Icon name={icon} size={40} color={theme.colors.textTertiary} /> : null}
      <AppText variant="title3" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="subhead" color="secondary" style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" size="sm" style={{ alignSelf: 'center' }} />
      ) : null}
    </View>
  );
}

export function EmptyState(props: StateProps) {
  return <CenteredState icon="search" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <CenteredState icon="warning" {...props} />;
}

export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
        minHeight: 240,
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.accent} />
      {label ? (
        <AppText variant="subhead" color="secondary">
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

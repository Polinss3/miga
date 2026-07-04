import { useCameraPermissions } from 'expo-camera';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Icon } from '@/components/ui';
import { useTheme } from '@/theme';

/** Renders children only when camera permission is granted; otherwise explains why we ask. */
export function CameraGate({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.xxl,
          gap: theme.spacing.lg,
          backgroundColor: theme.colors.background,
        }}
      >
        <Icon name="camera" size={44} color={theme.colors.textTertiary} />
        <AppText variant="title3" style={{ textAlign: 'center' }}>
          {t('scan.cameraPermissionTitle')}
        </AppText>
        <AppText variant="subhead" color="secondary" style={{ textAlign: 'center' }}>
          {t('scan.cameraPermissionBody')}
        </AppText>
        <Button label={t('scan.grantPermission')} onPress={() => void requestPermission()} />
      </View>
    );
  }

  return <>{children}</>;
}

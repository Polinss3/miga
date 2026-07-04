import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/ui';
import { getHealthProvider, type HealthPermission } from '@/lib/health';
import { supabase } from '@/lib/supabase/client';
import { useTheme } from '@/theme';

const REQUESTED_PERMISSIONS: HealthPermission[] = [
  'read_weight',
  'read_steps',
  'read_workouts',
  'read_active_energy',
  'write_nutrition',
  'write_water',
];

export default function HealthScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const provider = getHealthProvider();
  const [connected, setConnected] = useState(false);
  const platformLabel = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

  const connect = async () => {
    const available = await provider.isAvailable();
    if (!available) {
      Alert.alert(platformLabel, t('profile.healthNotAvailable'));
      return;
    }
    const granted = await provider.requestPermissions(REQUESTED_PERMISSIONS);
    if (granted) {
      setConnected(true);
      await supabase.from('health_connections').upsert(
        {
          platform: provider.platformName,
          connected: true,
          permissions: REQUESTED_PERMISSIONS,
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform' },
      );
    }
  };

  const disconnect = async () => {
    setConnected(false);
    await supabase
      .from('health_connections')
      .update({ connected: false })
      .eq('platform', provider.platformName);
  };

  const deleteData = () => {
    Alert.alert(t('profile.healthDeleteData'), t('profile.deleteAccountConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await supabase.rpc('delete_health_data');
        },
      },
    ]);
  };

  return (
    <Screen padBottom={false} contentStyle={{ paddingTop: theme.spacing.xl }}>
      <AppText variant="largeTitle">{t('profile.health')}</AppText>

      <Card style={{ gap: theme.spacing.md }}>
        <AppText variant="headline">{platformLabel}</AppText>
        <AppText variant="subhead" color="secondary">
          {t('profile.healthExplainer')}
        </AppText>
        {connected ? (
          <>
            <AppText variant="headline" color="accent">
              {t('profile.healthConnected')}
            </AppText>
            <Button label={t('profile.healthDisconnect')} variant="secondary" onPress={() => void disconnect()} />
          </>
        ) : (
          <Button label={t('profile.healthConnect')} onPress={() => void connect()} />
        )}
      </Card>

      <Card muted>
        <AppText variant="footnote" color="secondary">
          {t('profile.healthNotAvailable')}
        </AppText>
      </Card>

      <View style={{ gap: theme.spacing.sm }}>
        <Button label={t('profile.healthDeleteData')} variant="ghost" onPress={deleteData} />
      </View>
    </Screen>
  );
}

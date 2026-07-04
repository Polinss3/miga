import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText, Button, Icon, LoadingState, Screen } from '@/components/ui';
import { usePremium } from './hooks';
import { useTheme } from '@/theme';

/**
 * UI gate for premium AI features.
 *
 * Free users keep access while they have monthly quota left (with a counter),
 * so they can genuinely try the AI before paying. When quota runs out the
 * paywall replaces the screen. The backend enforces the same rule
 * independently — this component is presentation only.
 */
export function PremiumGate({ children, noteKey }: PropsWithChildren<{ noteKey: string }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data, isLoading } = usePremium();

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }

  if (data?.isPremium || (data?.freeQuotaLeft ?? 0) > 0) {
    return (
      <>
        {children}
        {!data?.isPremium ? (
          <View
            style={{
              position: 'absolute',
              top: 60,
              alignSelf: 'center',
              backgroundColor: theme.colors.accentSoft,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.xs,
              borderRadius: theme.radius.full,
            }}
          >
            <AppText variant="caption" color="accent">
              {t('premium.freeQuotaLeft', { count: data?.freeQuotaLeft ?? 0 })}
            </AppText>
          </View>
        ) : null}
      </>
    );
  }

  return (
    <Screen scroll={false}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <Icon name="lock" size={40} color={theme.colors.accent} />
        <AppText variant="title2" style={{ textAlign: 'center' }}>
          {t('premium.quotaTitle')}
        </AppText>
        <AppText variant="body" color="secondary" style={{ textAlign: 'center' }}>
          {t(noteKey)} {t('premium.quotaBody')}
        </AppText>
        <Button label={t('premium.subscribe')} onPress={() => router.push('/profile/premium')} />
        <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { AppText, Button, Card, Icon, Screen } from '@/components/ui';
import { usePremium } from '@/features/premium/hooks';
import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import {
  getPremiumPackages,
  purchasePremium,
  restorePurchases,
} from '@/lib/revenuecat';
import { useTheme } from '@/theme';

export default function PremiumScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: premium } = usePremium();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const { data: packages } = useQuery({
    queryKey: ['premiumPackages'],
    queryFn: getPremiumPackages,
  });

  const buy = async (identifier: string) => {
    setPurchasing(identifier);
    try {
      const success = await purchasePremium(identifier);
      if (success) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
        router.back();
      }
    } catch (error) {
      if (!(error as { userCancelled?: boolean }).userCancelled) {
        Alert.alert(t('errors.generic'), t('errors.genericBody'));
      }
    } finally {
      setPurchasing(null);
    }
  };

  const restore = async () => {
    const restored = await restorePurchases();
    if (restored) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
      router.back();
    }
  };

  const benefits = ['premium.benefit1', 'premium.benefit2', 'premium.benefit3', 'premium.benefit4'];

  return (
    <Screen padBottom={false} contentStyle={{ paddingTop: theme.spacing.xl }}>
      <AppText variant="largeTitle">{t('premium.title')}</AppText>
      <AppText variant="body" color="secondary">
        {t('premium.subtitle')}
      </AppText>

      <Card style={{ gap: theme.spacing.md }}>
        {benefits.map((key) => (
          <View key={key} style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
            <Icon name="check" size={18} color={theme.colors.accent} />
            <AppText variant="body" style={{ flex: 1 }}>
              {t(key)}
            </AppText>
          </View>
        ))}
      </Card>

      {premium?.isPremium ? (
        <Card muted>
          <AppText variant="headline" color="accent">
            {t('premium.active')}
          </AppText>
        </Card>
      ) : premium?.purchasesAvailable && packages && packages.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          {packages.map((pkg) => (
            <Button
              key={pkg.identifier}
              label={
                pkg.period === 'monthly'
                  ? `${t('premium.monthly')} — ${t('premium.perMonth', { price: pkg.priceString })}`
                  : pkg.period === 'yearly'
                    ? `${t('premium.yearly')} — ${t('premium.perYear', { price: pkg.priceString })}`
                    : pkg.priceString
              }
              variant={pkg.period === 'yearly' ? 'primary' : 'secondary'}
              onPress={() => void buy(pkg.identifier)}
              loading={purchasing === pkg.identifier}
              size="lg"
            />
          ))}
          <Button label={t('premium.restore')} variant="ghost" onPress={() => void restore()} />
        </View>
      ) : (
        <Card muted>
          <AppText variant="subhead" color="secondary">
            {t('premium.notAvailable')}
          </AppText>
        </Card>
      )}

      <AppText variant="caption" color="tertiary">
        {t('premium.legal')}
      </AppText>
    </Screen>
  );
}

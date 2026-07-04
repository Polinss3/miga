import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  ListItem,
  Screen,
  SectionHeader,
  TextField,
} from '@/components/ui';
import { signOut } from '@/features/auth/service';
import { useProfile } from '@/features/auth/useSession';
import { useLogWeight, useWeightLog } from '@/features/nutrition/hooks';
import { usePremium } from '@/features/premium/hooks';
import { useTargets } from '@/features/today/hooks';
import { setAppLanguage, type AppLanguage } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';
import { useTheme } from '@/theme';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { data: profile } = useProfile();
  const { data: targets } = useTargets();
  const { data: premium } = usePremium();
  const { data: weights } = useWeightLog(1);
  const logWeight = useLogWeight();
  const [weightDraft, setWeightDraft] = useState('');

  const changeLanguage = async (language: AppLanguage) => {
    await setAppLanguage(language);
    if (profile) {
      await supabase.from('profiles').update({ language }).eq('id', profile.id);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('auth.signOut'), t('auth.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('profile.deleteAccount'), t('profile.deleteAccountConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          // Edge Function removes all rows + the auth user (service role).
          await supabase.functions.invoke('delete-account');
          await signOut();
        },
      },
    ]);
  };

  const saveWeight = () => {
    const parsed = parseFloat(weightDraft.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    logWeight.mutate({ weightKg: parsed, date: new Date().toISOString().slice(0, 10) });
    setWeightDraft('');
  };

  return (
    <Screen padBottom={false} contentStyle={{ paddingTop: theme.spacing.xl }}>
      <AppText variant="largeTitle">{t('profile.title')}</AppText>
      <AppText variant="subhead" color="secondary">
        {profile?.display_name ?? ''}
      </AppText>

      <SectionHeader title={t('profile.goals')} />
      <Card style={{ gap: theme.spacing.sm }}>
        <ListItem
          title={t('profile.currentGoal')}
          value={profile ? t(`onboarding.goal.${goalKey(profile.goal)}`) : '—'}
        />
        <ListItem
          title={t('profile.dailyTargets')}
          value={targets ? `${targets.kcal} ${t('common.kcal')}` : '—'}
        />
        <ListItem
          title={t('profile.weight')}
          value={weights?.[0] ? `${weights[0].weight_kg} kg` : '—'}
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <TextField
              placeholder={t('profile.weightPlaceholder')}
              value={weightDraft}
              onChangeText={setWeightDraft}
              keyboardType="decimal-pad"
            />
          </View>
          <Button label={t('profile.logWeight')} size="sm" variant="secondary" onPress={saveWeight} />
        </View>
      </Card>

      <SectionHeader title={t('profile.language')} />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Chip label={t('profile.spanish')} selected={i18n.language === 'es'} onPress={() => void changeLanguage('es')} />
        <Chip label={t('profile.english')} selected={i18n.language === 'en'} onPress={() => void changeLanguage('en')} />
      </View>

      <SectionHeader title={t('profile.premiumSection')} />
      <Card>
        <ListItem
          icon="sparkles"
          title={premium?.isPremium ? t('premium.active') : t('premium.title')}
          subtitle={premium?.isPremium ? undefined : t('premium.subtitle')}
          onPress={() => router.push('/profile/premium')}
          chevron
        />
      </Card>

      <SectionHeader title={t('profile.privacy')} />
      <Card>
        <ListItem icon="heart" title={t('profile.health')} onPress={() => router.push('/profile/health')} chevron />
        <ListItem icon="shield" title={t('profile.privacyPolicy')} onPress={() => router.push('/profile/privacy')} chevron />
      </Card>

      <SectionHeader title={t('profile.account')} />
      <Card>
        <ListItem title={t('auth.signOut')} onPress={handleSignOut} />
        <ListItem title={t('profile.deleteAccount')} destructive onPress={handleDeleteAccount} />
      </Card>

      <AppText variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
        {t('profile.version')} {Constants.expoConfig?.version ?? '1.0.0'} · {t('onboarding.disclaimer')}
      </AppText>
    </Screen>
  );
}

function goalKey(goal: string): string {
  return { lose_fat: 'loseFat', gain_muscle: 'gainMuscle', maintain: 'maintain', recomposition: 'recomposition', health: 'health' }[
    goal
  ] as string;
}

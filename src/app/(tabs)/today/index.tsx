import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  Card,
  GlassIconButton,
  Icon,
  MacroBar,
  ProgressRing,
  Screen,
  SectionHeader,
  TextField,
  type IconName,
} from '@/components/ui';
import { useProfile } from '@/features/auth/useSession';
import { expiringSoon, useInventory } from '@/features/inventory/hooks';
import { useDayLog, useLogSupplement, useLogWater, useTargets } from '@/features/today/hooks';
import { useOfflineQueue } from '@/stores/offline-queue';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme';
import type { Meal, MealType } from '@/types/domain';
import { dayKey, timeOfDay } from '@/utils/dates';

export default function TodayScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = dayKey();

  const { data: profile } = useProfile();
  const { data: targets } = useTargets();
  const { data: log } = useDayLog(today);
  const { data: inventory } = useInventory();
  const pendingOps = useOfflineQueue((s) => s.queue.length);

  const logWater = useLogWater(today);
  const logSupplement = useLogSupplement(today);
  const { waterGlassMl } = useSettings();
  const [supplementDraft, setSupplementDraft] = useState('');

  const consumed = log?.totals.kcal ?? 0;
  const kcalTarget = targets?.kcal ?? 2000;
  const remaining = Math.round(kcalTarget - consumed);

  const greetingKey =
    timeOfDay() === 'morning'
      ? 'today.greetingMorning'
      : timeOfDay() === 'afternoon'
        ? 'today.greetingAfternoon'
        : 'today.greetingEvening';

  const tip = useMemo(() => {
    const proteinGap = (targets?.protein_g ?? 0) - (log?.totals.protein_g ?? 0);
    const expiring = expiringSoon(inventory ?? []);
    if (expiring.length > 0) return t('today.tipExpiry', { item: expiring[0].name });
    if (proteinGap > 30 && consumed > 0) return t('today.tipProtein', { grams: Math.round(proteinGap) });
    if ((log?.waterMl ?? 0) < (targets?.water_ml ?? 2000) / 3 && timeOfDay() !== 'morning')
      return t('today.tipWater');
    return t('today.tipDefault');
  }, [targets, log, inventory, consumed, t]);

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.lg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="largeTitle" style={{ flex: 1 }} numberOfLines={1}>
          {t(greetingKey, { name: profile?.display_name ?? '' }).replace(/,\s*$/, '')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <GlassIconButton icon="ai" onPress={() => router.push('/ai')} accessibilityLabel={t('tabs.ai')} />
          <GlassIconButton
            icon="profile"
            size={26}
            onPress={() => router.push('/profile')}
            accessibilityLabel={t('tabs.profile')}
          />
        </View>
      </View>

      {pendingOps > 0 ? (
        <Card muted>
          <AppText variant="footnote" color="secondary">
            {t('common.pendingSync')} · {t('common.syncedWhenOnline')}
          </AppText>
        </Card>
      ) : null}

      {/* Calories + macros */}
      <Card>
        <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
          <ProgressRing
            progress={kcalTarget > 0 ? consumed / kcalTarget : 0}
            centerLabel={`${Math.round(consumed)}`}
            centerCaption={`/ ${kcalTarget} ${t('common.kcal')}`}
          />
          <AppText variant="subhead" color={remaining >= 0 ? 'secondary' : 'danger'}>
            {remaining >= 0
              ? t('today.caloriesLeft', { count: remaining })
              : t('today.caloriesOver', { count: Math.abs(remaining) })}
          </AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.lg, alignSelf: 'stretch' }}>
            <MacroBar
              label={t('today.protein')}
              current={log?.totals.protein_g ?? 0}
              target={targets?.protein_g ?? 0}
              color={theme.colors.protein}
            />
            <MacroBar
              label={t('today.carbs')}
              current={log?.totals.carbs_g ?? 0}
              target={targets?.carbs_g ?? 0}
              color={theme.colors.carbs}
            />
            <MacroBar
              label={t('today.fat')}
              current={log?.totals.fat_g ?? 0}
              target={targets?.fat_g ?? 0}
              color={theme.colors.fat}
            />
          </View>
        </View>
      </Card>

      {/* Water / caffeine / supplements */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Card style={{ flex: 1, gap: theme.spacing.sm }}>
          <Icon name="water" size={20} color={theme.colors.water} />
          <AppText variant="headline">{((log?.waterMl ?? 0) / 1000).toFixed(1)} L</AppText>
          <AppText variant="caption" color="secondary">
            {t('today.water')}
          </AppText>
          <Button
            label={t('today.addWater')}
            size="sm"
            variant="secondary"
            onPress={() => logWater.mutate(waterGlassMl)}
          />
        </Card>
        <Card style={{ flex: 1, gap: theme.spacing.sm }}>
          <Icon name="caffeine" size={20} color={theme.colors.caffeine} />
          <AppText variant="headline">{Math.round(log?.caffeineMg ?? 0)} mg</AppText>
          <AppText variant="caption" color="secondary">
            {t('today.caffeine')}
          </AppText>
        </Card>
      </View>

      <Card style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon name="supplement" size={18} color={theme.colors.accent} />
          <AppText variant="headline">{t('today.supplements')}</AppText>
        </View>
        {log?.supplements.length ? (
          <AppText variant="subhead" color="secondary">
            {log.supplements.join(' · ')}
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <TextField
              placeholder={t('today.supplementName')}
              value={supplementDraft}
              onChangeText={setSupplementDraft}
              onSubmitEditing={() => {
                if (supplementDraft.trim()) {
                  logSupplement.mutate(supplementDraft.trim());
                  setSupplementDraft('');
                }
              }}
              returnKeyType="done"
            />
          </View>
          <Button
            label={t('common.add')}
            size="sm"
            variant="secondary"
            onPress={() => {
              if (supplementDraft.trim()) {
                logSupplement.mutate(supplementDraft.trim());
                setSupplementDraft('');
              }
            }}
          />
        </View>
      </Card>

      {/* Meals */}
      <SectionHeader title={t('today.meals')} />
      <MealsList meals={log?.meals ?? []} />

      {/* Quick actions */}
      <SectionHeader title={t('today.quickActions')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
        <QuickAction icon="camera" label={t('today.scanFood')} onPress={() => router.push('/scan/photo')} />
        <QuickAction icon="barcode" label={t('today.scanBarcode')} onPress={() => router.push('/scan/barcode')} />
        <QuickAction icon="receipt" label={t('today.scanReceipt')} onPress={() => router.push('/scan/receipt')} />
        <QuickAction icon="plus" label={t('today.addManual')} onPress={() => router.push('/scan/manual')} />
        <QuickAction icon="recipes" label={t('today.addFromRecipe')} onPress={() => router.push('/scan/recipe')} />
        <QuickAction icon="ai" label={t('today.askAi')} onPress={() => router.push('/ai')} />
      </View>

      {/* Tip */}
      <SectionHeader title={t('today.tips')} />
      <Card muted>
        <AppText variant="subhead" color="secondary">
          {tip}
        </AppText>
      </Card>
    </Screen>
  );
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'flexible'];

function MealsList({ meals }: { meals: Meal[] }) {
  const { t } = useTranslation();
  const theme = useTheme();

  const grouped = MEAL_ORDER.map((type) => ({
    type,
    meals: meals.filter((meal) => meal.meal_type === type),
  })).filter((group) => group.type !== 'flexible' || group.meals.length > 0);

  return (
    <View style={{ gap: theme.spacing.md }}>
      {grouped.map(({ type, meals: typeMeals }) => {
        const kcal = typeMeals
          .flatMap((meal) => meal.items ?? [])
          .reduce((sum, item) => sum + (item.nutrients?.kcal ?? 0), 0);
        const names = typeMeals.flatMap((meal) => (meal.items ?? []).map((item) => item.name));

        return (
          <Card key={type} style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="headline">{t(`today.${type === 'flexible' ? 'flexibleMeal' : type}`)}</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                {kcal > 0 ? (
                  <AppText variant="subhead" color="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                    {Math.round(kcal)} {t('common.kcal')}
                  </AppText>
                ) : null}
                <Pressable
                  onPress={() => router.push({ pathname: '/scan/manual', params: { mealType: type } })}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Icon name="plus" size={18} color={theme.colors.accent} />
                </Pressable>
              </View>
            </View>
            <AppText variant="subhead" color={names.length ? 'secondary' : 'tertiary'} numberOfLines={2}>
              {names.length ? names.join(', ') : t('today.emptyMeal')}
            </AppText>
          </Card>
        );
      })}
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: '30%',
        flexGrow: 1,
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: theme.isDark ? 0 : 1,
        borderColor: theme.colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon name={icon} size={24} color={theme.colors.accent} />
      <AppText variant="footnote" color="secondary" style={{ textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

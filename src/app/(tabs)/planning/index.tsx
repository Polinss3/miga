import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  GlassIconButton,
  Icon,
  LoadingState,
  Screen,
  type IconName,
} from '@/components/ui';
import {
  generatePlanDraft,
  useAcceptPlan,
  usePlan,
  useTogglePlanItem,
} from '@/features/planning/hooks';
import { PlanMealSheet } from '@/features/planning/PlanMealSheet';
import { usePremium } from '@/features/premium/hooks';
import { AiError } from '@/lib/ai/client';
import { useTheme } from '@/theme';
import type { MealPlanDraft } from '@/types/ai';
import type { MealPlanItem } from '@/types/domain';
import { dayKey, mondayOf, twoWeekDays } from '@/utils/dates';

export default function PlanningScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const days = useMemo(() => twoWeekDays(), []);
  const weekStart = days[0];
  const nextWeekStart = days[7];
  const [selectedDay, setSelectedDay] = useState(dayKey());
  const [view, setView] = useState<'day' | 'week'>('day');

  const { data: plan, isLoading } = usePlan(weekStart);
  const { data: nextPlan } = usePlan(nextWeekStart);
  const acceptPlan = useAcceptPlan();
  const toggleItem = useTogglePlanItem();
  const { data: premium } = usePremium();

  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<MealPlanDraft | null>(null);
  const [openItem, setOpenItem] = useState<MealPlanItem | null>(null);

  const allItems = useMemo(() => [...(plan?.items ?? []), ...(nextPlan?.items ?? [])], [plan, nextPlan]);

  // "Generate week" targets the week the selected day belongs to, so you can
  // plan next week (e.g. from a Sunday) just by picking a day in it.
  const selectedWeekStart = useMemo(() => mondayOf(selectedDay), [selectedDay]);
  const selectedWeekLabel = useMemo(() => {
    const start = new Date(`${selectedWeekStart}T12:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [selectedWeekStart]);

  const dayItems = allItems
    .filter((item) => item.date === selectedDay)
    .sort((a, b) => mealOrder(a) - mealOrder(b));

  const generate = async (scope: 'day' | 'week') => {
    if (!premium?.isPremium && (premium?.freeQuotaLeft ?? 0) <= 0) {
      router.push('/profile/premium');
      return;
    }
    setGenerating(true);
    try {
      const result = await generatePlanDraft({
        startDate: scope === 'day' ? selectedDay : selectedWeekStart,
        days: scope === 'day' ? 1 : 7,
      });
      setDraft(result);
    } catch (error) {
      if (error instanceof AiError && error.code === 'premium_required') {
        router.push('/profile/premium');
      } else if (error instanceof AiError && error.code === 'quota_exceeded') {
        Alert.alert(t('premium.quotaTitle'), t('errors.quotaExceeded'));
      } else {
        Alert.alert(t('errors.generic'), t('ai.error'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const accept = () => {
    if (!draft) return;
    acceptPlan.mutate(draft, {
      onSuccess: () => setDraft(null),
      onError: () => Alert.alert(t('errors.generic'), t('errors.genericBody')),
    });
  };

  if (generating) {
    return (
      <Screen scroll={false}>
        <LoadingState label={t('planning.generating')} />
        <AppText variant="footnote" color="tertiary" style={{ textAlign: 'center', paddingBottom: 120 }}>
          {t('planning.generatingHint')}
        </AppText>
      </Screen>
    );
  }

  if (draft) {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{t('planning.planReady')}</AppText>
        <AppText variant="subhead" color="secondary">
          {t('planning.totalPerDay', { kcal: Math.round(draft.daily_kcal_estimate) })}
        </AppText>
        {draft.meals.map((meal, index) => (
          <Card key={index} style={{ gap: 2 }}>
            <AppText variant="footnote" color="tertiary">
              {meal.date} · {t(`today.${meal.meal_type === 'flexible' ? 'flexibleMeal' : meal.meal_type}`)}
            </AppText>
            <AppText variant="headline">{meal.title}</AppText>
            {meal.description ? (
              <AppText variant="footnote" color="secondary" numberOfLines={2}>
                {meal.description}
              </AppText>
            ) : null}
            <AppText variant="footnote" color="tertiary">
              {Math.round(meal.nutrients.kcal)} {t('common.kcal')}
            </AppText>
          </Card>
        ))}
        <Button label={t('planning.acceptPlan')} onPress={accept} loading={acceptPlan.isPending} />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => setDraft(null)} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="largeTitle">{t('planning.title')}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <GlassIconButton icon="ai" onPress={() => router.push('/ai')} accessibilityLabel={t('tabs.ai')} />
          <GlassIconButton
            icon="cart"
            onPress={() => router.push('/planning/shopping')}
            accessibilityLabel={t('planning.shoppingList')}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Chip label={t('planning.day')} selected={view === 'day'} onPress={() => setView('day')} />
        <Chip label={t('planning.week')} selected={view === 'week'} onPress={() => setView('week')} />
      </View>

      {view === 'day' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
          {days.map((day) => {
            const selected = day === selectedDay;
            const date = new Date(`${day}T12:00:00`);
            return (
              <Pressable
                key={day}
                onPress={() => setSelectedDay(day)}
                accessibilityRole="button"
                style={{
                  alignItems: 'center',
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
                  borderWidth: selected || theme.isDark ? 0 : 1,
                  borderColor: theme.colors.border,
                  minWidth: 52,
                }}
              >
                <AppText
                  variant="caption"
                  style={{ color: selected ? theme.colors.textOnAccent : theme.colors.textTertiary }}
                >
                  {date.toLocaleDateString(undefined, { weekday: 'short' })}
                </AppText>
                <AppText
                  variant="headline"
                  style={{ color: selected ? theme.colors.textOnAccent : theme.colors.text }}
                >
                  {date.getDate()}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {isLoading ? (
        <LoadingState />
      ) : view === 'week' ? (
        days.map((day) => (
          <WeekDayCard
            key={day}
            day={day}
            items={allItems.filter((item) => item.date === day).sort((a, b) => mealOrder(a) - mealOrder(b))}
            isToday={day === dayKey()}
            onPress={() => {
              setSelectedDay(day);
              setView('day');
            }}
          />
        ))
      ) : dayItems.length === 0 ? (
        <EmptyState
          icon="planning"
          title={t('planning.empty')}
          message={t('planning.emptyHint')}
        />
      ) : (
        dayItems.map((item) => (
          <PlanItemCard
            key={item.id}
            item={item}
            onOpen={() => setOpenItem(item)}
            onToggleLock={() => toggleItem.mutate({ id: item.id, field: 'locked', value: !item.locked })}
            onToggleDone={() => toggleItem.mutate({ id: item.id, field: 'completed', value: !item.completed })}
          />
        ))
      )}

      <PlanMealSheet item={openItem} onClose={() => setOpenItem(null)} />

      <Button label={t('planning.generateDay')} icon="sparkles" variant="secondary" onPress={() => void generate('day')} />
      <Button label={t('planning.generateWeek')} icon="sparkles" onPress={() => void generate('week')} />
      <AppText variant="footnote" color="tertiary" style={{ textAlign: 'center' }}>
        {t('planning.generateWeekHint', { range: selectedWeekLabel })}
      </AppText>
      <AppText variant="footnote" color="tertiary" style={{ textAlign: 'center' }}>
        {t('planning.premiumNote')}
      </AppText>
    </Screen>
  );
}

function mealOrder(item: MealPlanItem): number {
  return ['breakfast', 'lunch', 'dinner', 'snack', 'flexible'].indexOf(item.meal_type);
}

/** Compact per-day summary used by the week view; tapping opens the day view. */
function WeekDayCard({
  day,
  items,
  isToday,
  onPress,
}: {
  day: string;
  items: MealPlanItem[];
  isToday: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const date = new Date(`${day}T12:00:00`);
  const totalKcal = items.reduce((sum, item) => sum + (item.nutrients?.kcal ?? 0), 0);

  return (
    <Card onPress={onPress} style={isToday ? { borderColor: theme.colors.accent, borderWidth: 1.5 } : undefined}>
      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="headline" color={isToday ? 'accent' : undefined}>
            {date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' })}
          </AppText>
          {totalKcal > 0 ? (
            <AppText variant="footnote" color="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
              {Math.round(totalKcal)} {t('common.kcal')}
            </AppText>
          ) : null}
        </View>
        {items.length === 0 ? (
          <AppText variant="footnote" color="tertiary">
            {t('planning.noMeals')}
          </AppText>
        ) : (
          items.map((item) => (
            <View
              key={item.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, opacity: item.completed ? 0.55 : 1 }}
            >
              <AppText variant="caption" color="tertiary" style={{ width: 72 }} numberOfLines={1}>
                {t(`today.${item.meal_type === 'flexible' ? 'flexibleMeal' : item.meal_type}`)}
              </AppText>
              <AppText
                variant="subhead"
                style={[{ flex: 1 }, item.completed ? { textDecorationLine: 'line-through' } : null]}
                numberOfLines={1}
              >
                {item.title}
              </AppText>
              {item.nutrients ? (
                <AppText variant="caption" color="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
                  {Math.round(item.nutrients.kcal)}
                </AppText>
              ) : null}
            </View>
          ))
        )}
      </View>
    </Card>
  );
}

function PlanItemCard({
  item,
  onOpen,
  onToggleLock,
  onToggleDone,
}: {
  item: MealPlanItem;
  onOpen: () => void;
  onToggleLock: () => void;
  onToggleDone: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Card onPress={onOpen} style={{ gap: theme.spacing.sm, opacity: item.completed ? 0.6 : 1 }}>
      <AppText variant="footnote" color="tertiary">
        {t(`today.${item.meal_type === 'flexible' ? 'flexibleMeal' : item.meal_type}`)}
      </AppText>
      <AppText variant="headline" style={item.completed ? { textDecorationLine: 'line-through' } : undefined}>
        {item.title}
      </AppText>
      {item.description ? (
        <AppText variant="footnote" color="secondary" numberOfLines={2}>
          {item.description}
        </AppText>
      ) : null}
      {item.nutrients ? (
        <AppText variant="footnote" color="tertiary">
          {Math.round(item.nutrients.kcal)} {t('common.kcal')} · P {Math.round(item.nutrients.protein_g)}g
        </AppText>
      ) : null}

      {/* Prominent, tappable actions */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
        <PlanActionPill
          icon="check"
          label={item.completed ? t('planning.completed') : t('planning.markCompleted')}
          active={item.completed}
          activeColor={theme.colors.success}
          onPress={onToggleDone}
        />
        <PlanActionPill
          icon="lock"
          label={item.locked ? t('planning.locked') : t('planning.lock')}
          active={item.locked}
          activeColor={theme.colors.accent}
          onPress={onToggleLock}
        />
      </View>
    </Card>
  );
}

function PlanActionPill({
  icon,
  label,
  active,
  activeColor,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: active ? `${activeColor}22` : theme.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: active ? activeColor : theme.colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={16} color={active ? activeColor : theme.colors.textSecondary} />
      <AppText variant="subhead" style={{ color: active ? activeColor : theme.colors.textSecondary, fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

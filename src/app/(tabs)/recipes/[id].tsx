import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  Card,
  Chip,
  ErrorState,
  LoadingState,
  MacroSummary,
  Screen,
  SectionHeader,
  Stepper,
} from '@/components/ui';
import {
  draftToInput,
  improveRecipe,
  recipeNutrientsPerServing,
  useCreateRecipe,
  useDeleteRecipe,
  useRecipe,
  type ImproveGoal,
} from '@/features/recipes/hooks';
import { addMealWithDeduction } from '@/features/today/hooks';
import { AiError } from '@/lib/ai/client';
import { useTheme } from '@/theme';
import type { RecipeDraft } from '@/types/ai';
import type { MealType } from '@/types/domain';
import { scaleNutrients } from '@/types/domain';
import { dayKey, suggestedMealType } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

const IMPROVE_GOALS: { goal: ImproveGoal; labelKey: string }[] = [
  { goal: 'healthier', labelKey: 'recipes.improveOptions.healthier' },
  { goal: 'more_protein', labelKey: 'recipes.improveOptions.moreProtein' },
  { goal: 'lower_calories', labelKey: 'recipes.improveOptions.lowerCalories' },
  { goal: 'cheaper', labelKey: 'recipes.improveOptions.cheaper' },
  { goal: 'use_inventory', labelKey: 'recipes.improveOptions.useInventory' },
  { goal: 'adapt_restrictions', labelKey: 'recipes.improveOptions.adaptRestrictions' },
];

export default function RecipeDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: recipe, isLoading, isError, refetch } = useRecipe(id);
  const deleteRecipe = useDeleteRecipe();
  const createRecipe = useCreateRecipe();

  const [improving, setImproving] = useState(false);
  const [improvedDraft, setImprovedDraft] = useState<RecipeDraft | null>(null);
  const [cooking, setCooking] = useState(false);
  const [mealType, setMealType] = useState<MealType>(suggestedMealType());
  const [servings, setServings] = useState(1);

  if (isLoading) return <LoadingState />;
  if (isError || !recipe) {
    return <ErrorState title={t('errors.notFound')} actionLabel={t('common.retry')} onAction={() => void refetch()} />;
  }

  const perServing = recipeNutrientsPerServing(recipe);

  const handleImprove = async (goal: ImproveGoal) => {
    setImproving(true);
    try {
      const draft = await improveRecipe(recipe.id, goal);
      setImprovedDraft(draft);
    } catch (error) {
      if (error instanceof AiError && error.code === 'premium_required') {
        router.push('/profile/premium');
      } else {
        Alert.alert(t('errors.generic'), t('ai.error'));
      }
    } finally {
      setImproving(false);
    }
  };

  const applyImprovement = () => {
    if (!improvedDraft) return;
    // Saved as a new recipe so the original is never destroyed silently.
    createRecipe.mutate(draftToInput(improvedDraft), {
      onSuccess: (newId) => {
        setImprovedDraft(null);
        router.replace({ pathname: '/recipes/[id]', params: { id: newId } });
      },
      onError: () => Alert.alert(t('errors.generic'), t('errors.genericBody')),
    });
  };

  const cookNow = async () => {
    setCooking(true);
    try {
      await addMealWithDeduction({
        date: dayKey(),
        mealType,
        items: [
          {
            name: recipe.name,
            quantity: servings,
            unit: 'serving',
            nutrients: scaleNutrients(perServing ?? {}, servings),
            recipe_id: recipe.id,
          },
        ],
        deductInventory: true,
      });
      router.back();
    } catch {
      Alert.alert(t('errors.generic'), t('errors.genericBody'));
    } finally {
      setCooking(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(recipe.name, t('recipes.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => deleteRecipe.mutate(recipe.id, { onSuccess: () => router.back() }),
      },
    ]);
  };

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
      <AppText variant="title">{recipe.name}</AppText>
      {recipe.description ? (
        <AppText variant="body" color="secondary">
          {recipe.description}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' }}>
        {recipe.time_minutes ? <Chip label={t('recipes.minutes', { count: recipe.time_minutes })} /> : null}
        <Chip label={t(`recipes.difficulty.${recipe.difficulty}`)} />
        <Chip label={t('recipes.servingsCount', { count: recipe.servings })} />
      </View>

      {perServing ? (
        <Card>
          <MacroSummary nutrients={perServing} caption={t('recipes.perServing')} />
        </Card>
      ) : null}

      <SectionHeader title={t('recipes.fields.ingredients')} />
      <Card style={{ gap: theme.spacing.sm }}>
        {recipe.ingredients.map((ingredient, index) => (
          <View key={`${ingredient.name}-${index}`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="body" style={{ flex: 1 }}>
              {ingredient.name}
            </AppText>
            <AppText variant="body" color="secondary" style={{ fontVariant: ['tabular-nums'] }}>
              {formatQuantity(ingredient.quantity, ingredient.unit)}
            </AppText>
          </View>
        ))}
      </Card>

      <SectionHeader title={t('recipes.fields.steps')} />
      <Card style={{ gap: theme.spacing.md }}>
        {recipe.steps.map((step, index) => (
          <View key={index} style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <AppText variant="headline" color="accent">
              {index + 1}
            </AppText>
            <AppText variant="body" style={{ flex: 1 }}>
              {step}
            </AppText>
          </View>
        ))}
      </Card>

      <SectionHeader title={t('recipes.logSection')} />
      <Card style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
            <Chip
              key={type}
              label={t(`today.${type}`)}
              selected={mealType === type}
              onPress={() => setMealType(type)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText variant="subhead" color="secondary">
            {t('recipes.fields.servings')}
          </AppText>
          <Stepper value={servings} onChange={setServings} />
        </View>
        {perServing ? <MacroSummary nutrients={perServing} factor={servings} approximate /> : null}
        <Button label={t('recipes.cookNow')} icon="flame" onPress={() => void cookNow()} loading={cooking} />
        <AppText variant="footnote" color="tertiary" style={{ textAlign: 'center' }}>
          {t('recipes.cookNowHint')}
        </AppText>
      </Card>

      <SectionHeader title={t('recipes.improve')} />
      {improvedDraft ? (
        <Card style={{ gap: theme.spacing.md, borderColor: theme.colors.accent, borderWidth: 1.5 }}>
          <AppText variant="headline">{t('recipes.improvePreview')}</AppText>
          <AppText variant="body">{improvedDraft.name}</AppText>
          {improvedDraft.change_summary ? (
            <AppText variant="subhead" color="secondary">
              {improvedDraft.change_summary}
            </AppText>
          ) : null}
          <AppText variant="footnote" color="tertiary">
            {Math.round(improvedDraft.nutrients_per_serving.kcal)} {t('common.kcal')} / {t('units.serving')}
          </AppText>
          <Button label={t('recipes.applyChanges')} onPress={applyImprovement} loading={createRecipe.isPending} />
          <Button label={t('common.cancel')} variant="ghost" onPress={() => setImprovedDraft(null)} />
        </Card>
      ) : improving ? (
        <LoadingState label={t('ai.thinking')} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {IMPROVE_GOALS.map(({ goal, labelKey }) => (
            <Chip key={goal} label={t(labelKey)} onPress={() => void handleImprove(goal)} />
          ))}
        </View>
      )}

      <Button label={t('common.delete')} variant="ghost" onPress={confirmDelete} />
    </Screen>
  );
}

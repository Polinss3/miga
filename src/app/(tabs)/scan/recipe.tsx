import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  LoadingState,
  Screen,
  Stepper,
  TextField,
} from '@/components/ui';
import { recipeNutrientsPerServing, useRecipes } from '@/features/recipes/hooks';
import { addMealWithDeduction } from '@/features/today/hooks';
import { useTheme } from '@/theme';
import type { MealType, Recipe } from '@/types/domain';
import { scaleNutrients } from '@/types/domain';
import { dayKey, suggestedMealType } from '@/utils/dates';

/** Log a saved recipe as one of today's meals. */
export default function LogRecipeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mealType?: MealType }>();
  const { data: recipes, isLoading } = useRecipes();

  const [query, setQuery] = useState('');
  const [mealType, setMealType] = useState<MealType>(params.mealType ?? suggestedMealType());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes ?? [];
    return (recipes ?? []).filter((recipe) => recipe.name.toLowerCase().includes(q));
  }, [recipes, query]);

  const logRecipe = async (recipe: Recipe) => {
    setSaving(true);
    try {
      await addMealWithDeduction({
        date: dayKey(),
        mealType,
        items: [
          {
            name: recipe.name,
            quantity: servings,
            unit: 'serving',
            nutrients: scaleNutrients(recipeNutrientsPerServing(recipe) ?? {}, servings),
            recipe_id: recipe.id,
          },
        ],
        deductInventory: false,
      });
      router.back();
    } catch {
      Alert.alert(t('errors.generic'), t('errors.genericBody'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
      <AppText variant="title">{t('recipes.logTitle')}</AppText>

      {!recipes || recipes.length === 0 ? (
        <EmptyState
          icon="recipes"
          title={t('recipes.empty')}
          message={t('recipes.emptyHint')}
          actionLabel={t('recipes.create')}
          onAction={() => router.replace('/recipes/create')}
        />
      ) : (
        <>
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

          <TextField placeholder={t('recipes.searchPlaceholder')} value={query} onChangeText={setQuery} />

          {filtered.map((recipe) => {
            const selected = recipe.id === selectedId;
            const per = recipeNutrientsPerServing(recipe);
            return (
              <Card
                key={recipe.id}
                onPress={() => {
                  setSelectedId(selected ? null : recipe.id);
                  setServings(1);
                }}
                style={selected ? { borderColor: theme.colors.accent, borderWidth: 1.5 } : undefined}
              >
                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="headline" numberOfLines={1}>
                    {recipe.name}
                  </AppText>
                  <AppText variant="footnote" color={per ? 'secondary' : 'tertiary'}>
                    {per
                      ? `${Math.round(per.kcal)} ${t('common.kcal')} · P ${Math.round(per.protein_g)}g · C ${Math.round(per.carbs_g)}g · G ${Math.round(per.fat_g)}g / ${t('units.serving')}`
                      : t('recipes.noMacros')}
                  </AppText>

                  {selected ? (
                    <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}>
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <AppText variant="subhead" color="secondary">
                          {t('recipes.fields.servings')}
                        </AppText>
                        <Stepper value={servings} onChange={setServings} />
                      </View>
                      {per ? (
                        <AppText variant="footnote" color="tertiary">
                          ≈ {Math.round(per.kcal * servings)} {t('common.kcal')} · P{' '}
                          {Math.round(per.protein_g * servings)}g · C {Math.round(per.carbs_g * servings)}g · G{' '}
                          {Math.round(per.fat_g * servings)}g
                        </AppText>
                      ) : null}
                      <Button
                        label={t('recipes.logAction')}
                        onPress={() => void logRecipe(recipe)}
                        loading={saving}
                      />
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

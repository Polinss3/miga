import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Card,
  EmptyState,
  ErrorState,
  GlassIconButton,
  LoadingState,
  Screen,
} from '@/components/ui';
import { recipeNutrientsPerServing, useRecipes } from '@/features/recipes/hooks';
import { useTheme } from '@/theme';

export default function RecipesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: recipes, isLoading, isError, refetch } = useRecipes();

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="largeTitle">{t('recipes.title')}</AppText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <GlassIconButton
            icon="sparkles"
            onPress={() => router.push('/recipes/import')}
            accessibilityLabel={t('recipes.importTitle')}
          />
          <GlassIconButton
            icon="plus"
            onPress={() => router.push('/recipes/create')}
            accessibilityLabel={t('recipes.create')}
          />
        </View>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState title={t('errors.generic')} actionLabel={t('common.retry')} onAction={() => void refetch()} />
      ) : !recipes || recipes.length === 0 ? (
        <EmptyState
          icon="recipes"
          title={t('recipes.empty')}
          message={t('recipes.emptyHint')}
          actionLabel={t('recipes.create')}
          onAction={() => router.push('/recipes/create')}
        />
      ) : (
        recipes.map((recipe) => {
          const per = recipeNutrientsPerServing(recipe);
          return (
          <Card key={recipe.id} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: recipe.id } })}>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="headline" numberOfLines={1}>
                {recipe.name}
              </AppText>
              <AppText variant="footnote" color="secondary" numberOfLines={2}>
                {recipe.description ?? ''}
              </AppText>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                {recipe.time_minutes ? (
                  <AppText variant="footnote" color="tertiary">
                    {t('recipes.minutes', { count: recipe.time_minutes })}
                  </AppText>
                ) : null}
                <AppText variant="footnote" color="tertiary">
                  {t(`recipes.difficulty.${recipe.difficulty}`)}
                </AppText>
              </View>
              {per ? (
                <AppText variant="footnote" color="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
                  {Math.round(per.kcal)} {t('common.kcal')} · P {Math.round(per.protein_g)}g · C{' '}
                  {Math.round(per.carbs_g)}g · G {Math.round(per.fat_g)}g / {t('units.serving')}
                </AppText>
              ) : null}
            </View>
          </Card>
          );
        })
      )}
    </Screen>
  );
}

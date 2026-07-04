import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { foodDisplayName, useFoodSearch, type CatalogFood } from './hooks';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';

interface FoodSuggestionsProps {
  query: string;
  onSelect: (food: CatalogFood) => void;
}

/**
 * Inline dropdown of catalog matches for a food-name input.
 * Renders nothing until the query has 2+ characters or when there are no hits.
 */
export function FoodSuggestions({ query, onSelect }: FoodSuggestionsProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { data: foods } = useFoodSearch(query);

  if (!foods || foods.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <AppText
        variant="caption"
        color="tertiary"
        style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }}
      >
        {t('foods.suggestionsTitle')}
      </AppText>
      {foods.map((food) => {
        const per100 = food.nutrients_per_100;
        return (
          <Pressable
            key={food.id}
            onPress={() => onSelect(food)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>
              {foodDisplayName(food, i18n.language)}
            </AppText>
            <AppText variant="footnote" color="secondary" style={{ fontVariant: ['tabular-nums'] }}>
              {Math.round(per100.kcal ?? 0)} {t('common.kcal')} · P {Math.round(per100.protein_g ?? 0)}g /100
              {food.unit === 'ml' ? 'ml' : 'g'}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

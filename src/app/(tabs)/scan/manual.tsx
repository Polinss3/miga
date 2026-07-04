import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Chip, Screen, TextField } from '@/components/ui';
import { FoodSuggestions } from '@/features/foods/FoodSuggestions';
import { foodDisplayName, type CatalogFood } from '@/features/foods/hooks';
import { useQuickLogMeal } from '@/features/today/hooks';
import { useTheme } from '@/theme';
import type { MealType } from '@/types/domain';
import { scaleNutrients } from '@/types/domain';
import { dayKey, suggestedMealType } from '@/utils/dates';

/**
 * Manual entry — deliberately friction-free and offline-capable.
 * Typing a name searches the foods catalog; picking a match pre-fills the
 * macros for the given grams, but everything stays editable.
 */
export default function ManualEntryScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mealType?: MealType }>();

  const [name, setName] = useState('');
  const [grams, setGrams] = useState('100');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealType, setMealType] = useState<MealType>(params.mealType ?? suggestedMealType());
  const [selectedFood, setSelectedFood] = useState<CatalogFood | null>(null);

  const quickLog = useQuickLogMeal();

  const fillFromFood = (food: CatalogFood, gramsValue: string) => {
    const factor = (parseFloat(gramsValue) || 100) / 100;
    const scaled = scaleNutrients(food.nutrients_per_100, factor);
    setKcal(String(Math.round(scaled.kcal)));
    setProtein(String(Math.round(scaled.protein_g * 10) / 10));
    setCarbs(String(Math.round(scaled.carbs_g * 10) / 10));
    setFat(String(Math.round(scaled.fat_g * 10) / 10));
  };

  const selectFood = (food: CatalogFood) => {
    setSelectedFood(food);
    setName(foodDisplayName(food, i18n.language));
    fillFromFood(food, grams);
  };

  const onNameChange = (text: string) => {
    setName(text);
    if (selectedFood && text !== foodDisplayName(selectedFood, i18n.language)) {
      setSelectedFood(null);
    }
  };

  const onGramsChange = (text: string) => {
    setGrams(text);
    if (selectedFood) fillFromFood(selectedFood, text);
  };

  const submit = () => {
    if (!name.trim()) return;
    quickLog.mutate(
      {
        date: dayKey(),
        mealType,
        name: name.trim(),
        quantity: parseFloat(grams) || 100,
        nutrients: {
          kcal: parseFloat(kcal) || 0,
          protein_g: parseFloat(protein) || 0,
          carbs_g: parseFloat(carbs) || 0,
          fat_g: parseFloat(fat) || 0,
        },
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
      <AppText variant="title">{t('scan.manualTitle')}</AppText>

      <TextField
        label={t('scan.manual.foodName')}
        placeholder={t('scan.manual.foodNamePlaceholder')}
        value={name}
        onChangeText={onNameChange}
        autoFocus
      />
      {!selectedFood ? <FoodSuggestions query={name} onSelect={selectFood} /> : null}
      {selectedFood ? (
        <AppText variant="footnote" color="tertiary">
          {t('foods.autofilled')}
        </AppText>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField label={t('scan.manual.grams')} value={grams} onChangeText={onGramsChange} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={t('common.kcal')} value={kcal} onChangeText={setKcal} keyboardType="numeric" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField label={t('today.protein')} value={protein} onChangeText={setProtein} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={t('today.carbs')} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={t('today.fat')} value={fat} onChangeText={setFat} keyboardType="numeric" />
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="subhead" color="secondary">
          {t('scan.manual.mealType')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
            <Chip key={type} label={t(`today.${type}`)} selected={mealType === type} onPress={() => setMealType(type)} />
          ))}
        </View>
      </View>

      <Button
        label={t('scan.manual.logFood')}
        onPress={submit}
        disabled={!name.trim()}
        loading={quickLog.isPending}
      />
      <Button
        label={t('scan.manual.chooseRecipe')}
        variant="ghost"
        icon="recipes"
        onPress={() => router.replace({ pathname: '/scan/recipe', params: { mealType } })}
      />
    </Screen>
  );
}

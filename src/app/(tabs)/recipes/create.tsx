import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, Chip, Icon, MacroSummary, Screen, SectionHeader, TextField } from '@/components/ui';
import { IngredientSheet } from '@/features/foods/IngredientSheet';
import { useCreateRecipe } from '@/features/recipes/hooks';
import { useTheme } from '@/theme';
import type { RecipeDifficulty, RecipeIngredient } from '@/types/domain';
import { addNutrients, EMPTY_NUTRIENTS, scaleNutrients } from '@/types/domain';
import { formatQuantity } from '@/utils/units';

export default function CreateRecipeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const createRecipe = useCreateRecipe();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState('2');
  const [time, setTime] = useState('30');
  const [difficulty, setDifficulty] = useState<RecipeDifficulty>('easy');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [stepDraft, setStepDraft] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);

  // Live per-serving macros from ingredients that carry nutrients.
  const servingsNum = Math.max(parseInt(servings, 10) || 1, 1);
  const perServing = useMemo(() => {
    const withMacros = ingredients.filter((ing) => ing.nutrients);
    if (withMacros.length === 0) return null;
    const totals = withMacros.reduce((acc, ing) => addNutrients(acc, ing.nutrients ?? {}), EMPTY_NUTRIENTS);
    return scaleNutrients(totals, 1 / servingsNum);
  }, [ingredients, servingsNum]);
  const missingMacros = ingredients.some((ing) => !ing.nutrients);

  const addStep = () => {
    if (!stepDraft.trim()) return;
    setSteps([...steps, stepDraft.trim()]);
    setStepDraft('');
  };

  const submit = () => {
    if (!name.trim() || ingredients.length === 0 || steps.length === 0) return;
    createRecipe.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        steps,
        time_minutes: parseInt(time, 10) || null,
        difficulty,
        servings: servingsNum,
        tags: [],
        restrictions: [],
        nutrients_per_serving: perServing,
        ingredients,
      },
      {
        onSuccess: (id) => router.replace({ pathname: '/recipes/[id]', params: { id } }),
        onError: () => Alert.alert(t('errors.generic'), t('errors.genericBody')),
      },
    );
  };

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
      <AppText variant="title">{t('recipes.create')}</AppText>

      <TextField label={t('recipes.fields.name')} value={name} onChangeText={setName} />
      <TextField
        label={`${t('recipes.fields.description')} (${t('common.optional')})`}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField label={t('recipes.fields.servings')} value={servings} onChangeText={setServings} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={t('recipes.fields.time')} value={time} onChangeText={setTime} keyboardType="number-pad" />
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="subhead" color="secondary" style={{ fontWeight: '500' }}>
          {t('recipes.fields.difficulty')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {(['easy', 'medium', 'hard'] as const).map((level) => (
            <Chip
              key={level}
              label={t(`recipes.difficulty.${level}`)}
              selected={difficulty === level}
              onPress={() => setDifficulty(level)}
            />
          ))}
        </View>
      </View>

      <SectionHeader title={t('recipes.fields.ingredients')} />
      {ingredients.map((ingredient, index) => (
        <View
          key={`${ingredient.name}-${index}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="body">
              {ingredient.name} — {formatQuantity(ingredient.quantity, ingredient.unit)}
            </AppText>
            {ingredient.nutrients ? (
              <AppText variant="footnote" color="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
                {Math.round(ingredient.nutrients.kcal ?? 0)} {t('common.kcal')} · P{' '}
                {Math.round(ingredient.nutrients.protein_g ?? 0)}g · C {Math.round(ingredient.nutrients.carbs_g ?? 0)}g · G{' '}
                {Math.round(ingredient.nutrients.fat_g ?? 0)}g
              </AppText>
            ) : (
              <AppText variant="footnote" color="tertiary">
                {t('foods.noMacrosOnIngredient')}
              </AppText>
            )}
          </View>
          <Pressable
            onPress={() => setIngredients(ingredients.filter((_, i) => i !== index))}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Icon name="close" size={16} color={theme.colors.textTertiary} />
          </Pressable>
        </View>
      ))}
      <Button
        label={t('foods.addIngredient')}
        icon="plus"
        variant="secondary"
        onPress={() => setSheetVisible(true)}
      />

      <SectionHeader title={t('recipes.fields.steps')} />
      {steps.map((step, index) => (
        <View key={index} style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <AppText variant="headline" color="accent">
            {index + 1}
          </AppText>
          <AppText variant="body" style={{ flex: 1 }}>
            {step}
          </AppText>
          <Pressable onPress={() => setSteps(steps.filter((_, i) => i !== index))} hitSlop={8} accessibilityRole="button">
            <Icon name="close" size={16} color={theme.colors.textTertiary} />
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('recipes.fields.addStep')}
            value={stepDraft}
            onChangeText={setStepDraft}
            onSubmitEditing={addStep}
            multiline
          />
        </View>
        <Button label={t('common.add')} size="sm" variant="secondary" onPress={addStep} style={{ alignSelf: 'auto', marginBottom: 4 }} />
      </View>

      {perServing ? (
        <Card muted style={{ gap: theme.spacing.sm }}>
          <MacroSummary nutrients={perServing} caption={t('recipes.perServing')} approximate />
          <AppText variant="footnote" color="tertiary">
            {missingMacros ? t('foods.partialMacrosHint') : t('foods.autoMacrosHint')}
          </AppText>
        </Card>
      ) : null}

      <Button
        label={t('common.save')}
        onPress={submit}
        disabled={!name.trim() || ingredients.length === 0 || steps.length === 0}
        loading={createRecipe.isPending}
      />

      <IngredientSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onAdd={(ingredient) => setIngredients((prev) => [...prev, ingredient])}
      />
    </Screen>
  );
}

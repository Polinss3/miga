import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useIngredientSearch, type FoodResult } from './hooks';

import { AppText, Button, Chip, MacroSummary, Sheet, TextField } from '@/components/ui';
import { useTheme } from '@/theme';
import type { FoodUnit, Nutrients, RecipeIngredient } from '@/types/domain';
import { scaleNutrients } from '@/types/domain';

interface IngredientSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (ingredient: RecipeIngredient) => void;
}

type Mode = 'search' | 'manual';

/**
 * MyFitnessPal-style ingredient picker in a native iOS sheet. Search the
 * catalog + scanned products and add with a quantity (macros scale
 * automatically), or enter a custom ingredient by hand. The returned
 * RecipeIngredient carries absolute nutrients for the chosen quantity.
 */
export function IngredientSheet({ visible, onClose, onAdd }: IngredientSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [amount, setAmount] = useState('100');

  // Manual entry
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('100');
  const [manualUnit, setManualUnit] = useState<FoodUnit>('g');
  const [mKcal, setMKcal] = useState('');
  const [mProtein, setMProtein] = useState('');
  const [mCarbs, setMCarbs] = useState('');
  const [mFat, setMFat] = useState('');

  const { data: results, isFetching } = useIngredientSearch(query);

  const reset = () => {
    setQuery('');
    setSelected(null);
    setAmount('100');
    setManualName('');
    setManualQty('100');
    setManualUnit('g');
    setMKcal('');
    setMProtein('');
    setMCarbs('');
    setMFat('');
    setMode('search');
  };

  const close = () => {
    reset();
    onClose();
  };

  const scaledPreview = useMemo<Nutrients | null>(() => {
    if (!selected) return null;
    const qty = parseFloat(amount) || 0;
    return scaleNutrients(selected.nutrients_per_100, qty / 100);
  }, [selected, amount]);

  const confirmSelected = () => {
    if (!selected) return;
    const qty = parseFloat(amount) || 0;
    onAdd({
      name: selected.brand ? `${selected.name} (${selected.brand})` : selected.name,
      quantity: qty,
      unit: selected.unit,
      nutrients: scaleNutrients(selected.nutrients_per_100, qty / 100),
    });
    close();
  };

  const confirmManual = () => {
    if (!manualName.trim()) return;
    const hasMacros = mKcal || mProtein || mCarbs || mFat;
    onAdd({
      name: manualName.trim(),
      quantity: parseFloat(manualQty) || 0,
      unit: manualUnit,
      nutrients: hasMacros
        ? {
            kcal: parseFloat(mKcal) || 0,
            protein_g: parseFloat(mProtein) || 0,
            carbs_g: parseFloat(mCarbs) || 0,
            fat_g: parseFloat(mFat) || 0,
          }
        : null,
    });
    close();
  };

  return (
    <Sheet visible={visible} onClose={close} title={t('foods.addIngredient')}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Chip label={t('foods.tabSearch')} selected={mode === 'search'} onPress={() => setMode('search')} />
        <Chip label={t('foods.tabManual')} selected={mode === 'manual'} onPress={() => setMode('manual')} />
      </View>

      {mode === 'search' ? (
        <>
          <TextField
            placeholder={t('foods.searchPlaceholder')}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setSelected(null);
            }}
            autoFocus
          />

          {selected ? (
            <View
              style={{
                gap: theme.spacing.md,
                borderWidth: 1.5,
                borderColor: theme.colors.accent,
                borderRadius: theme.radius.md,
                padding: theme.spacing.lg,
              }}
            >
              <AppText variant="headline">
                {selected.brand ? `${selected.name} · ${selected.brand}` : selected.name}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label={selected.unit === 'ml' ? t('units.ml') : t('units.g')}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    autoFocus
                  />
                </View>
                <Button label={t('common.add')} onPress={confirmSelected} style={{ flex: 1, alignSelf: 'auto' }} />
              </View>
              {scaledPreview ? <MacroSummary nutrients={scaledPreview} /> : null}
            </View>
          ) : (
            <View style={{ gap: theme.spacing.xs }}>
              {(results ?? []).map((food) => {
                const per = food.nutrients_per_100;
                return (
                  <Pressable
                    key={food.key}
                    onPress={() => {
                      setSelected(food);
                      setAmount('100');
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.md,
                      paddingVertical: theme.spacing.md,
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="body" numberOfLines={1}>
                        {food.name}
                      </AppText>
                      <AppText variant="caption" color="tertiary">
                        {food.brand ? `${food.brand} · ` : ''}
                        {food.kind === 'product' ? t('foods.kindProduct') : t('foods.kindCatalog')}
                      </AppText>
                    </View>
                    <AppText variant="footnote" color="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                      {Math.round(per.kcal ?? 0)} {t('common.kcal')}/100{food.unit === 'ml' ? 'ml' : 'g'}
                    </AppText>
                  </Pressable>
                );
              })}
              {query.trim().length >= 2 && !isFetching && (results?.length ?? 0) === 0 ? (
                <AppText
                  variant="footnote"
                  color="tertiary"
                  style={{ textAlign: 'center', paddingVertical: theme.spacing.md }}
                >
                  {t('foods.noResults')}
                </AppText>
              ) : null}
            </View>
          )}
        </>
      ) : (
        <>
          <TextField label={t('recipes.fields.ingredientName')} value={manualName} onChangeText={setManualName} autoFocus />
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField label={t('recipes.fields.amount')} value={manualQty} onChangeText={setManualQty} keyboardType="numeric" />
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.xs, flex: 2, flexWrap: 'wrap' }}>
              {(['g', 'ml', 'unit', 'serving'] as const).map((u) => (
                <Chip key={u} label={t(`units.${u}`)} selected={manualUnit === u} onPress={() => setManualUnit(u)} />
              ))}
            </View>
          </View>
          <AppText variant="footnote" color="tertiary">
            {t('foods.manualMacrosHint')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField label={t('common.kcal')} value={mKcal} onChangeText={setMKcal} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label={t('today.protein')} value={mProtein} onChangeText={setMProtein} keyboardType="numeric" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField label={t('today.carbs')} value={mCarbs} onChangeText={setMCarbs} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label={t('today.fat')} value={mFat} onChangeText={setMFat} keyboardType="numeric" />
            </View>
          </View>
          <Button label={t('common.add')} onPress={confirmManual} disabled={!manualName.trim()} />
        </>
      )}
    </Sheet>
  );
}

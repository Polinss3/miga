import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, Chip, LoadingState, Screen, TextField } from '@/components/ui';
import { useAddInventoryItem } from '@/features/inventory/hooks';
import { PremiumGate } from '@/features/premium/PremiumGate';
import { analyzeNutritionLabel } from '@/features/scan/service';
import { deleteLocalImage, usePhotoCapture } from '@/features/scan/usePhotoCapture';
import { AiError } from '@/lib/ai/client';
import { useTheme } from '@/theme';
import type { NutritionLabelAnalysis } from '@/types/ai';
import type { FoodUnit, InventoryLocation } from '@/types/domain';

type Phase =
  | { name: 'capture' }
  | { name: 'processing' }
  | { name: 'review'; analysis: NutritionLabelAnalysis };

/** Reads a nutrition label with AI — used when a barcode isn't in any catalog. */
export default function LabelScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const { capture, reset } = usePhotoCapture();
  const [phase, setPhase] = useState<Phase>({ name: 'capture' });
  const addInventory = useAddInventoryItem();

  // Editable product details — the label rarely tells us the product's name,
  // so the user completes them before anything hits the pantry.
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<FoodUnit>('unit');
  const [location, setLocation] = useState<InventoryLocation>('pantry');

  const process = async () => {
    const uri = await capture('camera');
    if (!uri) return;
    setPhase({ name: 'processing' });
    try {
      const analysis = await analyzeNutritionLabel(uri);
      setProductName(analysis.product_name ?? '');
      setPhase({ name: 'review', analysis });
    } catch (error) {
      if (error instanceof AiError && error.code === 'premium_required') {
        router.push('/profile/premium');
      } else {
        Alert.alert(t('errors.generic'), t('ai.error'));
      }
      setPhase({ name: 'capture' });
    } finally {
      await deleteLocalImage(uri);
      await reset();
    }
  };

  const saveToInventory = () => {
    if (phase.name !== 'review' || !productName.trim()) return;
    addInventory.mutate(
      {
        name: productName.trim(),
        brand: brand.trim() || null,
        quantity: parseFloat(quantity.replace(',', '.')) || 1,
        unit,
        location,
        source: 'barcode',
        barcode: barcode ?? null,
        nutrients_per_100: phase.analysis.nutrients_per_100,
      },
      {
        onSuccess: () => router.back(),
        onError: () => Alert.alert(t('errors.generic'), t('errors.genericBody')),
      },
    );
  };

  if (phase.name === 'processing') {
    return (
      <Screen scroll={false}>
        <LoadingState label={t('scan.label.processing')} />
      </Screen>
    );
  }

  if (phase.name === 'review') {
    const per100 = phase.analysis.nutrients_per_100;
    return (
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{t('scan.label.reviewTitle')}</AppText>
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="footnote" color="tertiary">
            {t('scan.barcode.per100', { unit: 'g' })}
          </AppText>
          {(
            [
              ['kcal', t('common.kcal')],
              ['protein_g', t('today.protein')],
              ['carbs_g', t('today.carbs')],
              ['fat_g', t('today.fat')],
            ] as const
          ).map(([key, label]) => (
            <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="body" color="secondary">
                {label}
              </AppText>
              <AppText variant="body" style={{ fontVariant: ['tabular-nums'] }}>
                {per100[key] != null ? Math.round(per100[key]! * 10) / 10 : '—'}
              </AppText>
            </View>
          ))}
        </Card>
        {phase.analysis.warnings.map((warning) => (
          <AppText key={warning} variant="footnote" color="tertiary">
            ⚠ {warning}
          </AppText>
        ))}

        <TextField
          label={t('inventory.fields.name')}
          placeholder={t('scan.label.namePlaceholder')}
          value={productName}
          onChangeText={setProductName}
        />
        <TextField
          label={`${t('inventory.fields.brand')} (${t('common.optional')})`}
          value={brand}
          onChangeText={setBrand}
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <TextField
              label={t('inventory.fields.quantity')}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.xs, flex: 2, flexWrap: 'wrap' }}>
            {(['unit', 'g', 'ml'] as const).map((u) => (
              <Chip key={u} label={t(`units.${u}`)} selected={unit === u} onPress={() => setUnit(u)} />
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {(['fridge', 'freezer', 'pantry', 'other'] as const).map((loc) => (
            <Chip
              key={loc}
              label={t(`inventory.locations.${loc}`)}
              selected={location === loc}
              onPress={() => setLocation(loc)}
            />
          ))}
        </View>

        <Button
          label={t('scan.barcode.addToInventory')}
          onPress={saveToInventory}
          disabled={!productName.trim()}
          loading={addInventory.isPending}
        />
        <Button label={t('scan.photo.retake')} variant="ghost" onPress={() => setPhase({ name: 'capture' })} />
      </Screen>
    );
  }

  return (
    <PremiumGate noteKey="scan.label.premiumNote">
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{t('scan.labelTitle')}</AppText>
        <AppText variant="body" color="secondary">
          {t('scan.label.prompt')}
        </AppText>
        <Button label={t('scan.labelTitle')} icon="camera" size="lg" onPress={() => void process()} />
      </Screen>
    </PremiumGate>
  );
}

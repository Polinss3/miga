import { CameraView } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, Chip, Glass, LoadingState, Screen, TextField } from '@/components/ui';
import { CameraGate } from '@/features/scan/CameraGate';
import { lookupBarcode } from '@/features/scan/service';
import { addMealWithDeduction } from '@/features/today/hooks';
import { useAddInventoryItem } from '@/features/inventory/hooks';
import { useTheme } from '@/theme';
import type { BarcodeProduct, FoodUnit } from '@/types/domain';
import { scaleNutrients } from '@/types/domain';
import { dayKey, suggestedMealType } from '@/utils/dates';

type Phase =
  | { name: 'scanning' }
  | { name: 'searching'; barcode: string }
  | { name: 'found'; product: BarcodeProduct }
  | { name: 'notFound'; barcode: string }
  | { name: 'error'; barcode: string };

export default function BarcodeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>({ name: 'scanning' });
  const [amount, setAmount] = useState('100');
  const [pantryQty, setPantryQty] = useState('1');
  const [pantryUnit, setPantryUnit] = useState<FoodUnit>('unit');
  const scanLock = useRef(false);
  const addInventory = useAddInventoryItem();

  const handleScan = async (barcode: string) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setPhase({ name: 'searching', barcode });
    try {
      const product = await lookupBarcode(barcode);
      if (product) {
        // Sensible starting amount: one serving when known, else 100 g/ml.
        setAmount(String(product.serving_size ?? 100));
        setPantryQty('1');
        setPantryUnit('unit');
      }
      setPhase(product ? { name: 'found', product } : { name: 'notFound', barcode });
    } catch {
      setPhase({ name: 'error', barcode });
    }
  };

  const logAsMeal = async (product: BarcodeProduct) => {
    const quantity = parseFloat(amount.replace(',', '.')) || 0;
    if (quantity <= 0) return;
    try {
      await addMealWithDeduction({
        date: dayKey(),
        mealType: suggestedMealType(),
        items: [
          {
            name: product.brand ? `${product.name} (${product.brand})` : product.name,
            quantity,
            unit: product.unit,
            nutrients: scaleNutrients(product.nutrients_per_100, quantity / 100),
          },
        ],
        deductInventory: false,
      });
      router.back();
    } catch {
      Alert.alert(t('errors.generic'), t('errors.genericBody'));
    }
  };

  const addToInventory = (product: BarcodeProduct) => {
    addInventory.mutate(
      {
        name: product.name,
        brand: product.brand,
        quantity: parseFloat(pantryQty.replace(',', '.')) || 1,
        unit: pantryUnit,
        location: 'pantry',
        source: 'barcode',
        barcode: product.barcode,
        nutrients_per_100: product.nutrients_per_100,
      },
      {
        onSuccess: () => router.back(),
        onError: () => Alert.alert(t('errors.generic'), t('errors.genericBody')),
      },
    );
  };

  if (phase.name === 'scanning' || phase.name === 'searching') {
    return (
      <CameraGate>
        <View style={{ flex: 1 }}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
            onBarcodeScanned={phase.name === 'scanning' ? ({ data }) => void handleScan(data) : undefined}
          />
          <Glass
            style={{
              position: 'absolute',
              bottom: insets.bottom + 100,
              left: theme.spacing.xl,
              right: theme.spacing.xl,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
            }}
          >
            <AppText variant="subhead" style={{ textAlign: 'center' }}>
              {phase.name === 'searching' ? t('scan.barcode.searching') : t('scan.barcode.prompt')}
            </AppText>
          </Glass>
        </View>
      </CameraGate>
    );
  }

  if (phase.name === 'error') {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{t('scan.barcode.errorTitle')}</AppText>
        <AppText variant="body" color="secondary">
          {t('scan.barcode.errorBody')}
        </AppText>
        <Button
          label={t('common.retry')}
          onPress={() => {
            scanLock.current = false;
            setPhase({ name: 'scanning' });
          }}
        />
        <Button
          label={t('scan.barcode.createManually')}
          variant="ghost"
          onPress={() =>
            router.replace({ pathname: '/inventory/add', params: { barcode: phase.barcode } })
          }
        />
      </Screen>
    );
  }

  if (phase.name === 'notFound') {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{t('scan.barcode.notFoundTitle')}</AppText>
        <AppText variant="body" color="secondary">
          {t('scan.barcode.notFoundBody')}
        </AppText>
        <Button
          label={t('scan.barcode.createManually')}
          variant="secondary"
          onPress={() =>
            router.replace({ pathname: '/inventory/add', params: { barcode: phase.barcode } })
          }
        />
        <Button
          label={t('scan.barcode.scanLabel')}
          icon="sparkles"
          onPress={() => router.replace({ pathname: '/scan/label', params: { barcode: phase.barcode } })}
        />
        <Button
          label={t('common.retry')}
          variant="ghost"
          onPress={() => {
            scanLock.current = false;
            setPhase({ name: 'scanning' });
          }}
        />
      </Screen>
    );
  }

  if (phase.name !== 'found') return <LoadingState />;
  const { product } = phase;
  const per100 = product.nutrients_per_100;
  const unitSuffix = product.unit === 'ml' ? 'ml' : 'g';
  const amountNum = parseFloat(amount.replace(',', '.')) || 0;
  const scaled = scaleNutrients(per100, amountNum / 100);

  // Serving-aware presets: "1 lata (330 ml)" beats guessing grams; otherwise
  // sensible defaults per unit (drinks come in bigger portions than solids).
  const presets: { label: string; value: number }[] = product.serving_size
    ? [1, 2, 3].map((n) => ({
        label: `${n} × ${product.serving_size}${unitSuffix}`,
        value: n * (product.serving_size ?? 0),
      }))
    : (product.unit === 'ml' ? [100, 250, 330, 500] : [50, 100, 150, 200]).map((v) => ({
        label: `${v}${unitSuffix}`,
        value: v,
      }));

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
      <AppText variant="title">{product.name}</AppText>
      {product.brand ? (
        <AppText variant="subhead" color="secondary">
          {product.brand}
        </AppText>
      ) : null}

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="footnote" color="tertiary">
          {t('scan.barcode.per100', { unit: unitSuffix })}
        </AppText>
        <NutrientRow label={t('common.kcal')} value={per100.kcal} />
        <NutrientRow label={t('today.protein')} value={per100.protein_g} suffix=" g" />
        <NutrientRow label={t('today.carbs')} value={per100.carbs_g} suffix=" g" />
        <NutrientRow label={t('today.fat')} value={per100.fat_g} suffix=" g" />
      </Card>

      {/* Log as meal, with unit-aware amounts */}
      <Card style={{ gap: theme.spacing.md }}>
        <AppText variant="headline">{t('scan.barcode.logAsFood')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {presets.map((preset) => (
            <Chip
              key={preset.label}
              label={preset.label}
              selected={amountNum === preset.value}
              onPress={() => setAmount(String(preset.value))}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <TextField
              label={`${t('scan.barcode.quantity')} (${unitSuffix})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>
          {amountNum > 0 ? (
            <View style={{ flex: 1 }}>
              <AppText variant="subhead" style={{ fontVariant: ['tabular-nums'] }}>
                {Math.round(scaled.kcal)} {t('common.kcal')}
              </AppText>
              <AppText variant="footnote" color="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                P {Math.round(scaled.protein_g)}g · C {Math.round(scaled.carbs_g)}g · G {Math.round(scaled.fat_g)}g
              </AppText>
            </View>
          ) : null}
        </View>
        <Button
          label={t('scan.barcode.logAsFood')}
          onPress={() => void logAsMeal(product)}
          disabled={amountNum <= 0}
        />
      </Card>

      {/* Add to pantry, with explicit quantity + unit (e.g. 12 eggs) */}
      <Card style={{ gap: theme.spacing.md }}>
        <AppText variant="headline">{t('scan.barcode.addToInventory')}</AppText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <TextField
              label={t('inventory.fields.quantity')}
              value={pantryQty}
              onChangeText={setPantryQty}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.xs, flex: 2, flexWrap: 'wrap' }}>
            {(['unit', 'g', 'ml'] as const).map((u) => (
              <Chip key={u} label={t(`units.${u}`)} selected={pantryUnit === u} onPress={() => setPantryUnit(u)} />
            ))}
          </View>
        </View>
        <AppText variant="footnote" color="tertiary">
          {t('scan.barcode.pantryQtyHint')}
        </AppText>
        <Button
          label={t('scan.barcode.addToInventory')}
          variant="secondary"
          onPress={() => addToInventory(product)}
          loading={addInventory.isPending}
        />
      </Card>

      <Button
        label={t('common.retry')}
        variant="ghost"
        onPress={() => {
          scanLock.current = false;
          setPhase({ name: 'scanning' });
        }}
      />
    </Screen>
  );
}

function NutrientRow({ label, value, suffix = '' }: { label: string; value?: number; suffix?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText variant="body" color="secondary">
        {label}
      </AppText>
      <AppText variant="body" style={{ fontVariant: ['tabular-nums'] }}>
        {value != null ? `${Math.round(value * 10) / 10}${suffix}` : '—'}
      </AppText>
    </View>
  );
}

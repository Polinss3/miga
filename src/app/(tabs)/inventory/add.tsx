import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Chip, Screen, TextField } from '@/components/ui';
import { useAddInventoryItem } from '@/features/inventory/hooks';
import { useTheme } from '@/theme';
import type { FoodUnit, InventoryLocation } from '@/types/domain';

export default function AddInventoryItemScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const addItem = useAddInventoryItem();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<FoodUnit>('unit');
  const [location, setLocation] = useState<InventoryLocation>('pantry');
  const [expiryDate, setExpiryDate] = useState('');
  const [price, setPrice] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      Alert.alert(t('errors.generic'), 'YYYY-MM-DD');
      return;
    }
    addItem.mutate(
      {
        name: name.trim(),
        brand: brand.trim() || null,
        quantity: parseFloat(quantity.replace(',', '.')) || 1,
        unit,
        location,
        source: barcode ? 'barcode' : 'manual',
        barcode: barcode ?? null,
        expiry_date: expiryDate || null,
        price: price ? parseFloat(price.replace(',', '.')) : null,
        purchase_date: new Date().toISOString().slice(0, 10),
      },
      {
        onSuccess: () => router.back(),
        onError: () => Alert.alert(t('errors.generic'), t('errors.genericBody')),
      },
    );
  };

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
      <AppText variant="title">{t('inventory.addItem')}</AppText>

      <TextField label={t('inventory.fields.name')} value={name} onChangeText={setName} autoFocus />
      <TextField label={`${t('inventory.fields.brand')} (${t('common.optional')})`} value={brand} onChangeText={setBrand} />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('inventory.fields.quantity')}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 2, gap: theme.spacing.sm }}>
          <AppText variant="subhead" color="secondary" style={{ fontWeight: '500' }}>
            {t('inventory.fields.unit')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            {(['unit', 'g', 'ml', 'serving'] as const).map((u) => (
              <Chip key={u} label={t(`units.${u === 'serving' ? 'serving' : u}`)} selected={unit === u} onPress={() => setUnit(u)} />
            ))}
          </View>
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="subhead" color="secondary" style={{ fontWeight: '500' }}>
          {t('inventory.fields.location')}
        </AppText>
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
      </View>

      <TextField
        label={`${t('inventory.fields.expiryDate')} (${t('common.optional')})`}
        placeholder="YYYY-MM-DD"
        value={expiryDate}
        onChangeText={setExpiryDate}
      />
      <TextField
        label={`${t('inventory.fields.price')} (${t('common.optional')})`}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />

      <Button label={t('common.save')} onPress={submit} disabled={!name.trim()} loading={addItem.isPending} />
    </Screen>
  );
}

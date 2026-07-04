import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { useDeleteInventoryItem, useUpdateInventoryItem } from './hooks';

import { AppText, Button, Card, Chip, Sheet, TextField } from '@/components/ui';
import { useTheme } from '@/theme';
import type { FoodUnit, InventoryItem, InventoryLocation } from '@/types/domain';

interface ItemSheetProps {
  item: InventoryItem | null;
  onClose: () => void;
}

const UNITS: FoodUnit[] = ['g', 'ml', 'unit'];
const LOCATIONS: InventoryLocation[] = ['fridge', 'freezer', 'pantry', 'other'];

/** Pantry item detail: view, edit (name/quantity/location/expiry) and delete. */
export function InventoryItemSheet({ item, onClose }: ItemSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<FoodUnit>('unit');
  const [location, setLocation] = useState<InventoryLocation>('pantry');
  const [expiry, setExpiry] = useState('');

  // Re-seed the form whenever a different item is opened.
  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setBrand(item.brand ?? '');
    setQuantity(String(item.quantity));
    setUnit(item.unit === 'serving' ? 'unit' : item.unit);
    setLocation(item.location);
    setExpiry(item.expiry_date ?? '');
  }, [item]);

  const save = () => {
    if (!item || !name.trim()) return;
    const expiryTrimmed = expiry.trim();
    if (expiryTrimmed && !/^\d{4}-\d{2}-\d{2}$/.test(expiryTrimmed)) {
      Alert.alert(t('errors.generic'), t('inventory.invalidDate'));
      return;
    }
    updateItem.mutate(
      {
        id: item.id,
        name: name.trim(),
        brand: brand.trim() || null,
        quantity: parseFloat(quantity.replace(',', '.')) || 0,
        unit,
        location,
        expiry_date: expiryTrimmed || null,
      },
      {
        onSuccess: onClose,
        onError: () => Alert.alert(t('errors.generic'), t('errors.genericBody')),
      },
    );
  };

  const confirmDelete = () => {
    if (!item) return;
    Alert.alert(item.name, t('inventory.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => deleteItem.mutate(item.id, { onSuccess: onClose }),
      },
    ]);
  };

  const per100 = item?.nutrients_per_100;

  return (
    <Sheet visible={item != null} onClose={onClose} title={t('inventory.itemDetail')}>
      {item ? (
        <>
          <TextField label={t('inventory.fields.name')} value={name} onChangeText={setName} />
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
              {UNITS.map((u) => (
                <Chip key={u} label={t(`units.${u}`)} selected={unit === u} onPress={() => setUnit(u)} />
              ))}
            </View>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="subhead" color="secondary" style={{ fontWeight: '500' }}>
              {t('inventory.fields.location')}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {LOCATIONS.map((loc) => (
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
            placeholder="2026-07-20"
            value={expiry}
            onChangeText={setExpiry}
            autoCapitalize="none"
          />

          {per100 && per100.kcal != null ? (
            <Card muted style={{ gap: theme.spacing.xs }}>
              <AppText variant="footnote" color="tertiary">
                {t('scan.barcode.per100', { unit: unit === 'ml' ? 'ml' : 'g' })}
              </AppText>
              <AppText variant="subhead" style={{ fontVariant: ['tabular-nums'] }}>
                {Math.round(per100.kcal)} {t('common.kcal')} · P {Math.round(per100.protein_g ?? 0)}g · C{' '}
                {Math.round(per100.carbs_g ?? 0)}g · G {Math.round(per100.fat_g ?? 0)}g
              </AppText>
            </Card>
          ) : null}

          <Button
            label={t('common.save')}
            onPress={save}
            disabled={!name.trim()}
            loading={updateItem.isPending}
          />
          <Button label={t('common.delete')} variant="ghost" onPress={confirmDelete} />
        </>
      ) : null}
    </Sheet>
  );
}

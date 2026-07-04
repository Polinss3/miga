import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  GlassIconButton,
  LoadingState,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { expiringSoon, useDeleteInventoryItem, useInventory } from '@/features/inventory/hooks';
import { InventoryItemSheet } from '@/features/inventory/ItemSheet';
import { useTheme } from '@/theme';
import type { InventoryItem, InventoryLocation } from '@/types/domain';
import { daysUntil } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

const LOCATIONS: (InventoryLocation | 'all')[] = ['all', 'fridge', 'freezer', 'pantry', 'other'];

export default function InventoryScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: items, isLoading, isError, refetch } = useInventory();
  const deleteItem = useDeleteInventoryItem();
  const [location, setLocation] = useState<InventoryLocation | 'all'>('all');
  const [openItem, setOpenItem] = useState<InventoryItem | null>(null);

  const filtered = useMemo(
    () => (items ?? []).filter((item) => location === 'all' || item.location === location),
    [items, location],
  );
  const expiring = useMemo(() => expiringSoon(items ?? []), [items]);

  const confirmDelete = (item: InventoryItem) => {
    Alert.alert(item.name, t('inventory.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteItem.mutate(item.id) },
    ]);
  };

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="largeTitle">{t('inventory.title')}</AppText>
        <GlassIconButton
          icon="plus"
          onPress={() => router.push('/inventory/add')}
          accessibilityLabel={t('inventory.addItem')}
        />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {LOCATIONS.map((loc) => (
          <Chip
            key={loc}
            label={loc === 'all' ? t('common.seeAll') : t(`inventory.locations.${loc}`)}
            selected={location === loc}
            onPress={() => setLocation(loc)}
          />
        ))}
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState title={t('errors.generic')} actionLabel={t('common.retry')} onAction={() => void refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="inventory"
          title={t('inventory.empty')}
          message={t('inventory.emptyHint')}
          actionLabel={t('inventory.addItem')}
          onAction={() => router.push('/inventory/add')}
        />
      ) : (
        <>
          {expiring.length > 0 && location === 'all' ? (
            <>
              <SectionHeader title={t('inventory.expiresSoon')} />
              {expiring.map((item) => (
                <InventoryRow
                  key={item.id}
                  item={item}
                  onPress={() => setOpenItem(item)}
                  onLongPress={() => confirmDelete(item)}
                  highlight
                />
              ))}
              <SectionHeader title={t('inventory.title')} />
            </>
          ) : null}
          {filtered
            .filter((item) => location !== 'all' || !expiring.some((e) => e.id === item.id))
            .map((item) => (
              <InventoryRow
                key={item.id}
                item={item}
                onPress={() => setOpenItem(item)}
                onLongPress={() => confirmDelete(item)}
              />
            ))}
        </>
      )}

      <InventoryItemSheet item={openItem} onClose={() => setOpenItem(null)} />
    </Screen>
  );
}

function InventoryRow({
  item,
  onPress,
  onLongPress,
  highlight,
}: {
  item: InventoryItem;
  onPress: () => void;
  onLongPress: () => void;
  highlight?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const expiryLabel = useMemo(() => {
    if (!item.expiry_date) return null;
    const days = daysUntil(item.expiry_date);
    if (days < 0) return t('inventory.expired');
    if (days === 0) return t('inventory.expiresToday');
    return t('inventory.expiresIn', { count: days });
  }, [item.expiry_date, t]);

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button">
      <Card style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="body" numberOfLines={1}>
              {item.name}
              {item.brand ? (
                <AppText variant="footnote" color="tertiary">
                  {'  '}
                  {item.brand}
                </AppText>
              ) : null}
            </AppText>
            <AppText variant="footnote" color="secondary">
              {formatQuantity(item.quantity, item.unit)} · {t(`inventory.locations.${item.location}`)}
              {expiryLabel ? (
                <AppText variant="footnote" color={highlight ? 'danger' : 'tertiary'}>
                  {'  ·  '}
                  {expiryLabel}
                </AppText>
              ) : null}
            </AppText>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

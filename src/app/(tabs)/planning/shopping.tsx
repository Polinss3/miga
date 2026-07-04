import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  Icon,
  LoadingState,
  Screen,
  SectionHeader,
} from '@/components/ui';
import {
  generateShoppingListDraft,
  useFinishShopping,
  useSaveShoppingList,
  useShoppingList,
  useToggleShoppingItem,
} from '@/features/planning/hooks';
import { usePremium } from '@/features/premium/hooks';
import { AiError } from '@/lib/ai/client';
import { useTheme } from '@/theme';
import type { ShoppingCategory, ShoppingListItem } from '@/types/domain';
import { dayKey } from '@/utils/dates';
import { formatQuantity } from '@/utils/units';

const CATEGORY_ORDER: ShoppingCategory[] = [
  'produce',
  'meat',
  'dairy',
  'grains',
  'frozen',
  'pantry',
  'drinks',
  'other',
];

export default function ShoppingListScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { data: list, isLoading } = useShoppingList();
  const saveList = useSaveShoppingList();
  const toggleItem = useToggleShoppingItem();
  const finishShopping = useFinishShopping();
  const { data: premium } = usePremium();
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!premium?.isPremium && (premium?.freeQuotaLeft ?? 0) <= 0) {
      router.push('/profile/premium');
      return;
    }
    setGenerating(true);
    try {
      // Shop for the next 7 days from today, so it spans the week boundary.
      const draft = await generateShoppingListDraft({ startDate: dayKey(), days: 7 });
      await saveList.mutateAsync(draft);
    } catch (error) {
      if (error instanceof AiError && error.code === 'premium_required') {
        router.push('/profile/premium');
      } else if (error instanceof AiError && error.code === 'quota_exceeded') {
        Alert.alert(t('premium.quotaTitle'), t('errors.quotaExceeded'));
      } else if (error instanceof AiError && error.message.includes('no planned meals')) {
        Alert.alert(t('shopping.noPlanTitle'), t('shopping.noPlanBody'));
      } else {
        Alert.alert(t('errors.generic'), t('ai.error'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const grouped = useMemo(() => {
    const items = list?.items ?? [];
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, [list]);

  const checkedCount = (list?.items ?? []).filter((item) => item.checked).length;

  const finish = () => {
    if (!list) return;
    finishShopping.mutate(list.id, {
      onSuccess: (count) => {
        Alert.alert(t('shopping.title'), t('shopping.addedToInventory', { count }));
      },
      onError: () => Alert.alert(t('errors.generic'), t('errors.genericBody')),
    });
  };

  return (
    <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
      <AppText variant="title">{t('shopping.title')}</AppText>

      {isLoading || generating ? (
        <LoadingState label={generating ? t('shopping.generating') : undefined} />
      ) : !list || list.items.length === 0 ? (
        <>
          <EmptyState icon="cart" title={t('shopping.empty')} message={t('shopping.emptyHint')} />
          <Button label={t('shopping.generate')} icon="sparkles" onPress={() => void generate()} />
          <AppText variant="footnote" color="tertiary" style={{ textAlign: 'center' }}>
            {t('shopping.generateHint')}
          </AppText>
        </>
      ) : (
        <>
          {grouped.map(({ category, items }) => (
            <View key={category} style={{ gap: theme.spacing.sm }}>
              <SectionHeader title={t(`shopping.categories.${category}`)} />
              <Card style={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.sm }}>
                {items.map((item) => (
                  <ShoppingRow key={item.id} item={item} onToggle={() => toggleItem.mutate({ id: item.id, checked: !item.checked })} />
                ))}
              </Card>
            </View>
          ))}

          {checkedCount > 0 ? (
            <>
              <Button label={t('shopping.finishShopping')} onPress={finish} loading={finishShopping.isPending} />
              <AppText variant="footnote" color="tertiary" style={{ textAlign: 'center' }}>
                {t('shopping.finishShoppingHint')}
              </AppText>
            </>
          ) : null}
          <Button label={t('shopping.regenerate')} variant="ghost" icon="sparkles" onPress={() => void generate()} />
        </>
      )}
    </Screen>
  );
}

function ShoppingRow({ item, onToggle }: { item: ShoppingListItem; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: theme.radius.full,
          borderWidth: 2,
          borderColor: item.checked ? theme.colors.accent : theme.colors.border,
          backgroundColor: item.checked ? theme.colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.checked ? <Icon name="check" size={13} color={theme.colors.textOnAccent} /> : null}
      </View>
      <AppText
        variant="body"
        style={{ flex: 1, textDecorationLine: item.checked ? 'line-through' : 'none' }}
        color={item.checked ? 'tertiary' : 'primary'}
      >
        {item.name}
      </AppText>
      {item.quantity != null && item.unit ? (
        <AppText variant="subhead" color="secondary" style={{ fontVariant: ['tabular-nums'] }}>
          {formatQuantity(item.quantity, item.unit)}
        </AppText>
      ) : null}
    </Pressable>
  );
}

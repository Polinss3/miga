import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, Icon, LoadingState, Screen } from '@/components/ui';
import { PremiumGate } from '@/features/premium/PremiumGate';
import { analyzeReceipt, confirmReceipt } from '@/features/scan/service';
import { deleteLocalImage, usePhotoCapture } from '@/features/scan/usePhotoCapture';
import { AiError } from '@/lib/ai/client';
import { useTheme } from '@/theme';
import type { ReceiptAnalysis } from '@/types/ai';
import { formatQuantity } from '@/utils/units';

type Phase =
  | { name: 'capture' }
  | { name: 'processing' }
  | { name: 'review'; analysis: ReceiptAnalysis };

export default function ReceiptScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { capture, reset } = usePhotoCapture();
  const [phase, setPhase] = useState<Phase>({ name: 'capture' });
  const [saving, setSaving] = useState(false);

  const process = async (source: 'camera' | 'library') => {
    const uri = await capture(source);
    if (!uri) return;
    setPhase({ name: 'processing' });
    try {
      const analysis = await analyzeReceipt(uri);
      setPhase({ name: 'review', analysis });
    } catch (error) {
      if (error instanceof AiError && error.code === 'premium_required') {
        router.push('/profile/premium');
      } else if (error instanceof AiError && error.code === 'quota_exceeded') {
        Alert.alert(t('premium.quotaTitle'), t('errors.quotaExceeded'));
      } else {
        Alert.alert(t('errors.generic'), t('ai.error'));
      }
      setPhase({ name: 'capture' });
    } finally {
      // Privacy: the receipt photo never outlives the analysis.
      await deleteLocalImage(uri);
      await reset();
    }
  };

  const removeItem = (index: number) => {
    if (phase.name !== 'review') return;
    setPhase({
      name: 'review',
      analysis: { ...phase.analysis, items: phase.analysis.items.filter((_, i) => i !== index) },
    });
  };

  const confirm = async () => {
    if (phase.name !== 'review') return;
    setSaving(true);
    try {
      await confirmReceipt(phase.analysis);
      router.back();
    } catch {
      Alert.alert(t('errors.generic'), t('errors.genericBody'));
    } finally {
      setSaving(false);
    }
  };

  if (phase.name === 'processing') {
    return (
      <Screen scroll={false}>
        <LoadingState label={t('scan.receipt.processing')} />
      </Screen>
    );
  }

  if (phase.name === 'review') {
    const { analysis } = phase;
    const foodItems = analysis.items.filter((item) => item.is_food);

    return (
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{t('scan.receipt.reviewTitle')}</AppText>
        <AppText variant="subhead" color="secondary">
          {[
            analysis.store,
            analysis.date,
            analysis.total != null ? `${analysis.total.toFixed(2)} ${analysis.currency ?? '€'}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <AppText variant="footnote" color="tertiary">
          {t('scan.receipt.items', { count: foodItems.length })} · {t('scan.receipt.privacyNote')}
        </AppText>

        {analysis.items.map((item, index) => (
          <Card key={`${item.name}-${index}`} muted={!item.is_food} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="body" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="footnote" color="secondary">
                  {formatQuantity(item.quantity, item.unit)}
                  {item.price != null ? ` · ${item.price.toFixed(2)}` : ''} ·{' '}
                  {t(`shopping.categories.${item.category}`)}
                </AppText>
              </View>
              <Pressable onPress={() => removeItem(index)} hitSlop={8} accessibilityRole="button">
                <Icon name="trash" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
          </Card>
        ))}

        <Button label={t('scan.receipt.confirm')} onPress={() => void confirm()} loading={saving} />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => setPhase({ name: 'capture' })} />
      </Screen>
    );
  }

  return (
    <PremiumGate noteKey="scan.receipt.premiumNote">
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{t('scan.receiptTitle')}</AppText>
        <AppText variant="body" color="secondary">
          {t('scan.receipt.prompt')}
        </AppText>
        <Button label={t('scan.receiptTitle')} icon="camera" size="lg" onPress={() => void process('camera')} />
        <AppText variant="footnote" color="tertiary" style={{ textAlign: 'center' }}>
          {t('scan.receipt.privacyNote')}
        </AppText>
      </Screen>
    </PremiumGate>
  );
}

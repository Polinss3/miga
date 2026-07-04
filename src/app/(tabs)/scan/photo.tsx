import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, Chip, LoadingState, Screen, TextField } from '@/components/ui';
import { PremiumGate } from '@/features/premium/PremiumGate';
import { usePhotoCapture, deleteLocalImage } from '@/features/scan/usePhotoCapture';
import { analyzeFoodPhoto } from '@/features/scan/service';
import { addMealWithDeduction } from '@/features/today/hooks';
import { AiError } from '@/lib/ai/client';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme';
import type { FoodPhotoAnalysis } from '@/types/ai';
import { scaleNutrients, type MealType } from '@/types/domain';
import { dayKey, suggestedMealType } from '@/utils/dates';

type Phase =
  | { name: 'capture' }
  | { name: 'analyzing' }
  | { name: 'review'; analysis: FoodPhotoAnalysis; grams: Record<number, number> };

export default function FoodPhotoScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { capture, reset } = usePhotoCapture();
  const { photoAnalysisMode, setPhotoAnalysisMode } = useSettings();
  const [phase, setPhase] = useState<Phase>({ name: 'capture' });
  const [mealType, setMealType] = useState<MealType>(suggestedMealType());
  const [saving, setSaving] = useState(false);

  const analyze = async (source: 'camera' | 'library') => {
    const uri = await capture(source);
    if (!uri) return;
    setPhase({ name: 'analyzing' });
    try {
      const analysis = await analyzeFoodPhoto(uri, photoAnalysisMode);
      if (!analysis.is_food || analysis.items.length === 0) {
        Alert.alert(t('errors.generic'), t('errors.aiInvalidResponse'));
        setPhase({ name: 'capture' });
        return;
      }
      const grams: Record<number, number> = {};
      analysis.items.forEach((item, index) => {
        grams[index] = Math.round(item.estimated_grams);
      });
      setPhase({ name: 'review', analysis, grams });
    } catch (error) {
      handleAiError(error);
      setPhase({ name: 'capture' });
    } finally {
      // Privacy: local photo is deleted as soon as the analysis returns.
      await deleteLocalImage(uri);
      await reset();
    }
  };

  const handleAiError = (error: unknown) => {
    if (error instanceof AiError && error.code === 'premium_required') {
      router.push('/profile/premium');
      return;
    }
    if (error instanceof AiError && error.code === 'quota_exceeded') {
      Alert.alert(t('premium.quotaTitle'), t('errors.quotaExceeded'));
      return;
    }
    Alert.alert(t('errors.generic'), t('ai.error'));
  };

  const confirmMeal = async () => {
    if (phase.name !== 'review') return;
    setSaving(true);
    try {
      await addMealWithDeduction({
        date: dayKey(),
        mealType,
        items: phase.analysis.items.map((item, index) => {
          const grams = phase.grams[index] ?? item.estimated_grams;
          return {
            name: item.name,
            quantity: grams,
            unit: 'g',
            nutrients: scaleNutrients(item.nutrients, grams / item.estimated_grams),
          };
        }),
        deductInventory: false,
      });
      router.back();
    } catch {
      Alert.alert(t('errors.generic'), t('errors.genericBody'));
    } finally {
      setSaving(false);
    }
  };

  if (phase.name === 'analyzing') {
    return (
      <Screen scroll={false}>
        <LoadingState label={t('scan.photo.processing')} />
      </Screen>
    );
  }

  if (phase.name === 'review') {
    const totals = phase.analysis.items.reduce(
      (sum, item, index) => {
        const factor = (phase.grams[index] ?? item.estimated_grams) / item.estimated_grams;
        return sum + item.nutrients.kcal * factor;
      },
      0,
    );

    return (
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{t('scan.photo.reviewTitle')}</AppText>
        <AppText variant="subhead" color="secondary">
          {t('scan.photo.confidence', { value: phase.analysis.overall_confidence })} · ≈{Math.round(totals)}{' '}
          {t('common.kcal')}
        </AppText>

        {phase.analysis.items.map((item, index) => (
          <Card key={`${item.name}-${index}`} style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="headline" style={{ flex: 1 }}>
                {item.name}
              </AppText>
              <AppText variant="subhead" color="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                {Math.round(
                  item.nutrients.kcal * ((phase.grams[index] ?? item.estimated_grams) / item.estimated_grams),
                )}{' '}
                {t('common.kcal')}
              </AppText>
            </View>
            {photoAnalysisMode === 'precise' ? (
              <TextField
                label={t('scan.manual.grams')}
                keyboardType="number-pad"
                value={String(phase.grams[index] ?? '')}
                onChangeText={(text) => {
                  const parsed = parseInt(text, 10);
                  setPhase({
                    ...phase,
                    grams: { ...phase.grams, [index]: Number.isFinite(parsed) ? parsed : 0 },
                  });
                }}
              />
            ) : (
              <AppText variant="footnote" color="tertiary">
                ≈ {Math.round(item.estimated_grams)} g
              </AppText>
            )}
          </Card>
        ))}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
            <Chip key={type} label={t(`today.${type}`)} selected={mealType === type} onPress={() => setMealType(type)} />
          ))}
        </View>

        <Button label={t('scan.photo.logMeal')} onPress={() => void confirmMeal()} loading={saving} />
        <Button label={t('scan.photo.retake')} variant="ghost" onPress={() => setPhase({ name: 'capture' })} />
      </Screen>
    );
  }

  return (
    <PremiumGate noteKey="scan.photo.premiumNote">
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{t('scan.photoTitle')}</AppText>
        <AppText variant="body" color="secondary">
          {t('scan.photo.prompt')}
        </AppText>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Chip
            label={`${t('scan.photo.modeFast')} · ${t('scan.photo.modeFastHint')}`}
            selected={photoAnalysisMode === 'fast'}
            onPress={() => setPhotoAnalysisMode('fast')}
          />
          <Chip
            label={`${t('scan.photo.modePrecise')}`}
            selected={photoAnalysisMode === 'precise'}
            onPress={() => setPhotoAnalysisMode('precise')}
          />
        </View>

        <Button label={t('scan.photoTitle')} icon="camera" onPress={() => void analyze('camera')} size="lg" />
        <AppText variant="footnote" color="tertiary" style={{ textAlign: 'center' }}>
          {t('scan.receipt.privacyNote')}
        </AppText>
      </Screen>
    </PremiumGate>
  );
}

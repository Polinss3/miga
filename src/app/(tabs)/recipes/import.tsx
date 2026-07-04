import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, Chip, LoadingState, Screen, TextField } from '@/components/ui';
import { PremiumGate } from '@/features/premium/PremiumGate';
import {
  draftRecipeFromPhoto,
  draftRecipeFromText,
  draftToInput,
  useCreateRecipe,
} from '@/features/recipes/hooks';
import { deleteLocalImage, usePhotoCapture } from '@/features/scan/usePhotoCapture';
import { AiError } from '@/lib/ai/client';
import { useTheme } from '@/theme';
import type { RecipeDraft } from '@/types/ai';

type Mode = 'paste' | 'generate' | 'photo';

/** Import a recipe: paste text, describe it, or photograph it — AI structures it. */
export default function ImportRecipeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const createRecipe = useCreateRecipe();
  const { capture, reset } = usePhotoCapture();

  const [mode, setMode] = useState<Mode>('generate');
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);

  const run = async () => {
    setProcessing(true);
    try {
      let result: RecipeDraft;
      if (mode === 'photo') {
        const uri = await capture('camera');
        if (!uri) {
          setProcessing(false);
          return;
        }
        try {
          result = await draftRecipeFromPhoto(uri);
        } finally {
          await deleteLocalImage(uri);
          await reset();
        }
      } else {
        if (!text.trim()) {
          setProcessing(false);
          return;
        }
        result = await draftRecipeFromText(text.trim(), mode);
      }
      setDraft(result);
    } catch (error) {
      if (error instanceof AiError && error.code === 'premium_required') {
        router.push('/profile/premium');
      } else {
        Alert.alert(t('errors.generic'), t('ai.error'));
      }
    } finally {
      setProcessing(false);
    }
  };

  const save = () => {
    if (!draft) return;
    createRecipe.mutate(draftToInput(draft), {
      onSuccess: (id) => router.replace({ pathname: '/recipes/[id]', params: { id } }),
      onError: () => Alert.alert(t('errors.generic'), t('errors.genericBody')),
    });
  };

  if (processing) {
    return (
      <Screen scroll={false}>
        <LoadingState label={t('ai.thinking')} />
      </Screen>
    );
  }

  if (draft) {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{draft.name}</AppText>
        {draft.description ? (
          <AppText variant="body" color="secondary">
            {draft.description}
          </AppText>
        ) : null}
        <Card style={{ gap: theme.spacing.xs }}>
          <AppText variant="footnote" color="tertiary">
            {t('recipes.perServing')}
          </AppText>
          <AppText variant="headline">
            {Math.round(draft.nutrients_per_serving.kcal)} {t('common.kcal')} · P{' '}
            {Math.round(draft.nutrients_per_serving.protein_g)}g
          </AppText>
        </Card>
        <Card style={{ gap: theme.spacing.xs }}>
          {draft.ingredients.map((ingredient, index) => (
            <AppText key={index} variant="body">
              • {ingredient.name} — {ingredient.quantity} {ingredient.unit}
            </AppText>
          ))}
        </Card>
        <Card style={{ gap: theme.spacing.sm }}>
          {draft.steps.map((step, index) => (
            <AppText key={index} variant="body">
              {index + 1}. {step}
            </AppText>
          ))}
        </Card>
        <Button label={t('common.save')} onPress={save} loading={createRecipe.isPending} />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => setDraft(null)} />
      </Screen>
    );
  }

  return (
    <PremiumGate noteKey="recipes.premiumNote">
      <Screen contentStyle={{ paddingTop: insets.top + theme.spacing.xl }}>
        <AppText variant="title">{t('recipes.importTitle')}</AppText>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Chip label={t('recipes.importAi')} selected={mode === 'generate'} onPress={() => setMode('generate')} />
          <Chip label={t('recipes.importPaste')} selected={mode === 'paste'} onPress={() => setMode('paste')} />
          <Chip label={t('recipes.importPhoto')} selected={mode === 'photo'} onPress={() => setMode('photo')} />
        </View>

        <AppText variant="subhead" color="secondary">
          {mode === 'generate'
            ? t('recipes.importAiHint')
            : mode === 'paste'
              ? t('recipes.importPasteHint')
              : t('recipes.importPhotoHint')}
        </AppText>

        {mode !== 'photo' ? (
          <TextField
            placeholder={mode === 'generate' ? t('recipes.importAiPlaceholder') : ''}
            value={text}
            onChangeText={setText}
            multiline
            style={{ minHeight: 140 }}
          />
        ) : null}

        <Button
          label={mode === 'photo' ? t('scan.photoTitle') : t('recipes.importTitle')}
          icon={mode === 'photo' ? 'camera' : 'sparkles'}
          onPress={() => void run()}
          disabled={mode !== 'photo' && !text.trim()}
        />
      </Screen>
    </PremiumGate>
  );
}

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Card, TextField } from '@/components/ui';
import {
  ChipSelect,
  NumberField,
  OptionList,
  TagInput,
  type Option,
} from '@/features/onboarding/components';
import { completeOnboarding, resolveTargets } from '@/features/onboarding/service';
import { setAppLanguage } from '@/lib/i18n';
import { useOnboardingDraft } from '@/stores/onboarding';
import { useTheme } from '@/theme';
import type { DietaryRestriction } from '@/types/domain';

const TOTAL_STEPS = 9;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const draft = useOnboardingDraft();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const targetsPreview = useMemo(() => resolveTargets(draft), [draft]);

  const finish = async () => {
    setSaving(true);
    try {
      await completeOnboarding(draft);
      // Root layout redirects to (tabs) once profile.onboarding_completed=true.
    } catch {
      Alert.alert(t('errors.generic'), t('errors.genericBody'));
      setSaving(false);
    }
  };

  const next = () => (step < TOTAL_STEPS - 1 ? setStep(step + 1) : void finish());
  const back = () => step > 0 && setStep(step - 1);

  const toggleRestriction = (value: DietaryRestriction) => {
    draft.update({
      restrictions: draft.restrictions.includes(value)
        ? draft.restrictions.filter((r) => r !== value)
        : [...draft.restrictions, value],
    });
  };

  const steps = [
    // 0 — Name
    <View key="name" style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">{t('onboarding.name.title')}</AppText>
      <NumberlessField
        placeholder={t('onboarding.name.placeholder')}
        value={draft.name}
        onChange={(name) => draft.update({ name })}
      />
    </View>,

    // 1 — Language & country
    <View key="language" style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">{t('onboarding.language.title')}</AppText>
      <OptionList
        options={[
          { value: 'es', label: 'Español' },
          { value: 'en', label: 'English' },
        ]}
        value={draft.language}
        onChange={(language) => {
          draft.update({ language });
          void setAppLanguage(language);
        }}
      />
      <NumberlessField
        label={t('onboarding.language.country')}
        placeholder={t('onboarding.language.countryPlaceholder')}
        value={draft.country}
        onChange={(country) => draft.update({ country })}
      />
    </View>,

    // 2 — Body
    <View key="body" style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">{t('onboarding.body.title')}</AppText>
      <AppText variant="subhead" color="secondary">
        {t('onboarding.body.subtitle')}
      </AppText>
      <NumberField label={t('onboarding.body.age')} value={draft.age} onChange={(age) => draft.update({ age })} />
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="subhead" color="secondary">
          {t('onboarding.body.sex')} · {t('onboarding.body.sexHint')}
        </AppText>
        <ChipSelect
          options={[
            { value: 'male', label: t('onboarding.body.male') },
            { value: 'female', label: t('onboarding.body.female') },
            { value: 'unspecified', label: t('onboarding.body.preferNot') },
          ]}
          values={[draft.sex]}
          onToggle={(sex) => draft.update({ sex })}
        />
      </View>
      <NumberField
        label={t('onboarding.body.height')}
        value={draft.heightCm}
        onChange={(heightCm) => draft.update({ heightCm })}
      />
      <NumberField
        label={t('onboarding.body.weight')}
        value={draft.weightKg}
        onChange={(weightKg) => draft.update({ weightKg })}
        allowDecimal
      />
      <NumberField
        label={t('onboarding.body.targetWeight')}
        value={draft.targetWeightKg}
        onChange={(targetWeightKg) => draft.update({ targetWeightKg })}
        allowDecimal
      />
    </View>,

    // 3 — Activity
    <View key="activity" style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">{t('onboarding.activity.title')}</AppText>
      <OptionList
        options={[
          { value: 'sedentary', label: t('onboarding.activity.sedentary'), hint: t('onboarding.activity.sedentaryHint') },
          { value: 'light', label: t('onboarding.activity.light'), hint: t('onboarding.activity.lightHint') },
          { value: 'moderate', label: t('onboarding.activity.moderate'), hint: t('onboarding.activity.moderateHint') },
          { value: 'active', label: t('onboarding.activity.active'), hint: t('onboarding.activity.activeHint') },
          { value: 'athlete', label: t('onboarding.activity.athlete'), hint: t('onboarding.activity.athleteHint') },
        ]}
        value={draft.activityLevel}
        onChange={(activityLevel) => draft.update({ activityLevel })}
      />
    </View>,

    // 4 — Goal
    <View key="goal" style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">{t('onboarding.goal.title')}</AppText>
      <OptionList
        options={[
          { value: 'lose_fat', label: t('onboarding.goal.loseFat') },
          { value: 'gain_muscle', label: t('onboarding.goal.gainMuscle') },
          { value: 'maintain', label: t('onboarding.goal.maintain') },
          { value: 'recomposition', label: t('onboarding.goal.recomposition') },
          { value: 'health', label: t('onboarding.goal.health') },
        ]}
        value={draft.goal}
        onChange={(goal) => draft.update({ goal })}
      />
    </View>,

    // 5 — Diet & restrictions
    <View key="diet" style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">{t('onboarding.diet.title')}</AppText>
      <AppText variant="subhead" color="secondary">
        {t('onboarding.diet.subtitle')}
      </AppText>
      <ChipSelect
        options={restrictionOptions(t)}
        values={draft.restrictions}
        onToggle={toggleRestriction}
      />
      <TagInput
        label={t('onboarding.diet.allergies')}
        placeholder={t('onboarding.diet.allergiesPlaceholder')}
        tags={draft.allergies}
        onChange={(allergies) => draft.update({ allergies })}
      />
      <TagInput
        label={t('onboarding.diet.dislikes')}
        placeholder={t('onboarding.diet.dislikesPlaceholder')}
        tags={draft.dislikes}
        onChange={(dislikes) => draft.update({ dislikes })}
      />
    </View>,

    // 6 — Meals & planning style
    <View key="meals" style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">{t('onboarding.meals.title')}</AppText>
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="subhead" color="secondary">
          {t('onboarding.meals.mealsPerDay')}
        </AppText>
        <ChipSelect
          options={['2', '3', '4', '5', '6'].map((n) => ({ value: n, label: n }))}
          values={[String(draft.mealsPerDay)]}
          onToggle={(n) => draft.update({ mealsPerDay: parseInt(n, 10) })}
        />
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="subhead" color="secondary">
          {t('onboarding.meals.planningStyle')}
        </AppText>
        <OptionList
          options={[
            { value: 'structured', label: t('onboarding.meals.structured'), hint: t('onboarding.meals.structuredHint') },
            { value: 'flexible', label: t('onboarding.meals.flexible'), hint: t('onboarding.meals.flexibleHint') },
            { value: 'mixed', label: t('onboarding.meals.mixed'), hint: t('onboarding.meals.mixedHint') },
          ]}
          value={draft.planningStyle}
          onChange={(planningStyle) => draft.update({ planningStyle })}
        />
      </View>
    </View>,

    // 7 — Cooking & budget
    <View key="cooking" style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">{t('onboarding.cooking.title')}</AppText>
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="subhead" color="secondary">
          {t('onboarding.cooking.skill')}
        </AppText>
        <ChipSelect
          options={[
            { value: 'beginner', label: t('onboarding.cooking.beginner') },
            { value: 'intermediate', label: t('onboarding.cooking.intermediate') },
            { value: 'advanced', label: t('onboarding.cooking.advanced') },
          ]}
          values={[draft.cookingSkill]}
          onToggle={(cookingSkill) => draft.update({ cookingSkill })}
        />
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="subhead" color="secondary">
          {t('onboarding.cooking.time')}
        </AppText>
        <ChipSelect
          options={[15, 30, 45, 60].map((minutes) => ({
            value: String(minutes),
            label: t('onboarding.cooking.minutes', { count: minutes }),
          }))}
          values={[String(draft.cookingTimeMinutes)]}
          onToggle={(minutes) => draft.update({ cookingTimeMinutes: parseInt(minutes, 10) })}
        />
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="subhead" color="secondary">
          {t('onboarding.cooking.budget')}
        </AppText>
        <ChipSelect
          options={[
            { value: 'low', label: t('onboarding.cooking.budgetLow') },
            { value: 'medium', label: t('onboarding.cooking.budgetMedium') },
            { value: 'high', label: t('onboarding.cooking.budgetHigh') },
          ]}
          values={[draft.budgetLevel]}
          onToggle={(budgetLevel) => draft.update({ budgetLevel })}
        />
      </View>
    </View>,

    // 8 — Targets + health + finish
    <View key="targets" style={{ gap: theme.spacing.lg }}>
      <AppText variant="title">{t('onboarding.targets.title')}</AppText>
      <AppText variant="subhead" color="secondary">
        {t('onboarding.targets.subtitle')}
      </AppText>
      <Card>
        <View style={{ gap: theme.spacing.sm }}>
          <TargetRow label={t('onboarding.targets.calories')} value={`${targetsPreview.kcal} kcal`} />
          <TargetRow label={t('onboarding.targets.protein')} value={`${targetsPreview.protein_g} g`} />
          <TargetRow label={t('onboarding.targets.carbs')} value={`${targetsPreview.carbs_g} g`} />
          <TargetRow label={t('onboarding.targets.fat')} value={`${targetsPreview.fat_g} g`} />
        </View>
      </Card>
      <ChipSelect
        options={[
          { value: 'automatic', label: t('onboarding.targets.automatic') },
          { value: 'manual', label: t('onboarding.targets.manual') },
        ]}
        values={[draft.targetsMode]}
        onToggle={(targetsMode) =>
          draft.update({
            targetsMode,
            manualTargets:
              targetsMode === 'manual'
                ? {
                    kcal: targetsPreview.kcal,
                    protein_g: targetsPreview.protein_g,
                    carbs_g: targetsPreview.carbs_g,
                    fat_g: targetsPreview.fat_g,
                  }
                : null,
          })
        }
      />
      {draft.targetsMode === 'manual' && draft.manualTargets ? (
        <View style={{ gap: theme.spacing.md }}>
          <NumberField
            label={t('onboarding.targets.calories')}
            value={draft.manualTargets.kcal}
            onChange={(kcal) =>
              kcal != null && draft.update({ manualTargets: { ...draft.manualTargets!, kcal } })
            }
          />
          <NumberField
            label={t('onboarding.targets.protein')}
            value={draft.manualTargets.protein_g}
            onChange={(protein_g) =>
              protein_g != null && draft.update({ manualTargets: { ...draft.manualTargets!, protein_g } })
            }
          />
        </View>
      ) : null}
      <AppText variant="footnote" color="tertiary">
        {t('onboarding.disclaimer')}
      </AppText>
    </View>,
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.lg,
          paddingHorizontal: theme.spacing.xl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="footnote" color="tertiary">
            {t('onboarding.stepOf', { current: step + 1, total: TOTAL_STEPS })}
          </AppText>
          <ProgressDots total={TOTAL_STEPS} current={step} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {steps[step]}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          {step > 0 ? (
            <Button label={t('common.back')} variant="ghost" onPress={back} style={{ flex: 1 }} />
          ) : null}
          <Button
            label={step === TOTAL_STEPS - 1 ? t('onboarding.finish') : t('common.next')}
            onPress={next}
            loading={saving}
            style={{ flex: 2 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: theme.radius.full,
            backgroundColor: i <= current ? theme.colors.accent : theme.colors.surfaceMuted,
          }}
        />
      ))}
    </View>
  );
}

function TargetRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText variant="body" color="secondary">
        {label}
      </AppText>
      <AppText variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
    </View>
  );
}

/** Plain text field wrapper aligned with NumberField's API. */
function NumberlessField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return <TextField label={label} placeholder={placeholder} value={value} onChangeText={onChange} />;
}

function restrictionOptions(t: (key: string) => string): Option<DietaryRestriction>[] {
  return [
    { value: 'vegetarian', label: t('onboarding.diet.vegetarian') },
    { value: 'vegan', label: t('onboarding.diet.vegan') },
    { value: 'gluten_free', label: t('onboarding.diet.glutenFree') },
    { value: 'lactose_free', label: t('onboarding.diet.lactoseFree') },
    { value: 'keto', label: t('onboarding.diet.keto') },
    { value: 'halal', label: t('onboarding.diet.halal') },
    { value: 'other', label: t('onboarding.diet.other') },
  ];
}

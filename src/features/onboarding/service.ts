import { setAppLanguage } from '@/lib/i18n';
import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { supabase } from '@/lib/supabase/client';
import type { OnboardingDraft } from '@/stores/onboarding';
import { calculateTargets, DEFAULT_TARGETS } from '@/utils/nutrition';

/**
 * Persists the whole onboarding in a single RPC (transactional server-side):
 * profile + goals/targets + dietary preferences + allergies.
 */
export async function completeOnboarding(draft: OnboardingDraft): Promise<void> {
  const targets = resolveTargets(draft);

  const { error } = await supabase.rpc('complete_onboarding', {
    p_profile: {
      display_name: draft.name.trim() || null,
      language: draft.language,
      country: draft.country.trim() || null,
      age: draft.age,
      sex: draft.sex,
      height_cm: draft.heightCm,
      weight_kg: draft.weightKg,
      target_weight_kg: draft.targetWeightKg,
      activity_level: draft.activityLevel,
      goal: draft.goal,
      planning_style: draft.planningStyle,
      cooking_skill: draft.cookingSkill,
      cooking_time_minutes: draft.cookingTimeMinutes,
      budget_level: draft.budgetLevel,
      meals_per_day: draft.mealsPerDay,
      targets_mode: draft.targetsMode,
    },
    p_targets: targets,
    p_restrictions: draft.restrictions,
    p_allergies: draft.allergies,
    p_dislikes: draft.dislikes,
  });
  if (error) throw error;

  await setAppLanguage(draft.language);
  await queryClient.invalidateQueries({ queryKey: queryKeys.profile });
  await queryClient.invalidateQueries({ queryKey: queryKeys.targets });
}

export function resolveTargets(draft: OnboardingDraft) {
  if (draft.targetsMode === 'manual' && draft.manualTargets) {
    return { ...draft.manualTargets, water_ml: DEFAULT_TARGETS.water_ml };
  }
  if (draft.age && draft.heightCm && draft.weightKg) {
    return calculateTargets({
      sex: draft.sex,
      age: draft.age,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      activityLevel: draft.activityLevel,
      goal: draft.goal,
    });
  }
  return DEFAULT_TARGETS;
}

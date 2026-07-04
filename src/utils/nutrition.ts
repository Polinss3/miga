import type { ActivityLevel, DailyTargets, Goal, Sex } from '@/types/domain';

/**
 * Nutrition target math. Pure functions — unit tested in __tests__/nutrition.test.ts.
 *
 * These produce reasonable general-purpose estimates (Mifflin-St Jeor + standard
 * activity multipliers). They are estimates, not medical advice; the UI shows a
 * disclaimer wherever targets appear for the first time.
 */

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

const GOAL_KCAL_DELTA: Record<Goal, number> = {
  lose_fat: -0.18, // ~18% deficit
  gain_muscle: 0.1, // ~10% surplus
  maintain: 0,
  recomposition: -0.05,
  health: 0,
};

/** Protein g per kg of body weight by goal. */
const GOAL_PROTEIN_PER_KG: Record<Goal, number> = {
  lose_fat: 2.0,
  gain_muscle: 1.8,
  maintain: 1.6,
  recomposition: 2.0,
  health: 1.4,
};

export interface TargetInputs {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

/** Mifflin-St Jeor basal metabolic rate. Unspecified sex uses the midpoint. */
export function bmr({ sex, age, heightCm, weightKg }: Omit<TargetInputs, 'activityLevel' | 'goal'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // midpoint of +5 and -161
}

export function tdee(inputs: Omit<TargetInputs, 'goal'>): number {
  return bmr(inputs) * ACTIVITY_MULTIPLIER[inputs.activityLevel];
}

/**
 * Daily calorie + macro targets:
 *  - kcal: TDEE adjusted by goal, floored at a safe minimum.
 *  - protein: per-kg by goal.
 *  - fat: 30% of kcal.
 *  - carbs: remaining kcal.
 */
export function calculateTargets(inputs: TargetInputs): DailyTargets {
  const maintenance = tdee(inputs);
  const rawKcal = maintenance * (1 + GOAL_KCAL_DELTA[inputs.goal]);
  const minKcal = inputs.sex === 'male' ? 1500 : 1200;
  const kcal = Math.round(Math.max(rawKcal, minKcal));

  const protein_g = Math.round(GOAL_PROTEIN_PER_KG[inputs.goal] * inputs.weightKg);
  const proteinKcal = protein_g * 4;
  const fatKcal = kcal * 0.3;
  const fat_g = Math.round(fatKcal / 9);
  const carbs_g = Math.round(Math.max(kcal - proteinKcal - fatKcal, 0) / 4);

  const water_ml = Math.round(Math.min(Math.max(inputs.weightKg * 33, 1500), 4000) / 50) * 50;

  return { kcal, protein_g, carbs_g, fat_g, water_ml };
}

/** Sensible fallback targets when the profile lacks body data. */
export const DEFAULT_TARGETS: DailyTargets = {
  kcal: 2000,
  protein_g: 110,
  carbs_g: 220,
  fat_g: 67,
  water_ml: 2000,
};

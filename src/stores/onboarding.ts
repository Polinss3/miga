import { create } from 'zustand';

import type {
  ActivityLevel,
  BudgetLevel,
  CookingSkill,
  DietaryRestriction,
  Goal,
  PlanningStyle,
  Sex,
} from '@/types/domain';

/**
 * In-memory draft for the onboarding wizard. Values are written to Supabase
 * in one RPC at the end, so a half-finished onboarding never leaves
 * partial rows behind.
 */
export interface OnboardingDraft {
  name: string;
  language: 'es' | 'en';
  country: string;
  age: number | null;
  sex: Sex;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  activityLevel: ActivityLevel;
  goal: Goal;
  restrictions: DietaryRestriction[];
  allergies: string[];
  dislikes: string[];
  mealsPerDay: number;
  planningStyle: PlanningStyle;
  cookingSkill: CookingSkill;
  cookingTimeMinutes: number;
  budgetLevel: BudgetLevel;
  targetsMode: 'automatic' | 'manual';
  manualTargets: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
}

interface OnboardingState extends OnboardingDraft {
  update: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
}

const initialDraft: OnboardingDraft = {
  name: '',
  language: 'es',
  country: '',
  age: null,
  sex: 'unspecified',
  heightCm: null,
  weightKg: null,
  targetWeightKg: null,
  activityLevel: 'light',
  goal: 'health',
  restrictions: [],
  allergies: [],
  dislikes: [],
  mealsPerDay: 3,
  planningStyle: 'mixed',
  cookingSkill: 'intermediate',
  cookingTimeMinutes: 30,
  budgetLevel: 'medium',
  targetsMode: 'automatic',
  manualTargets: null,
};

export const useOnboardingDraft = create<OnboardingState>((set) => ({
  ...initialDraft,
  update: (patch) => set(patch),
  reset: () => set(initialDraft),
}));

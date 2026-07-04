/**
 * Core domain model. These types mirror the Supabase schema
 * (see supabase/migrations) and are shared across features.
 */

export type Sex = 'male' | 'female' | 'unspecified';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';

export type Goal = 'lose_fat' | 'gain_muscle' | 'maintain' | 'recomposition' | 'health';

export type DietaryRestriction =
  | 'vegetarian'
  | 'vegan'
  | 'gluten_free'
  | 'lactose_free'
  | 'keto'
  | 'halal'
  | 'other';

export type PlanningStyle = 'structured' | 'flexible' | 'mixed';

export type CookingSkill = 'beginner' | 'intermediate' | 'advanced';

export type BudgetLevel = 'low' | 'medium' | 'high';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'flexible';

export type InventoryLocation = 'fridge' | 'freezer' | 'pantry' | 'other';

export type InventorySource = 'receipt' | 'barcode' | 'manual' | 'recipe' | 'shopping';

export type ShoppingCategory =
  | 'produce'
  | 'meat'
  | 'dairy'
  | 'grains'
  | 'frozen'
  | 'pantry'
  | 'drinks'
  | 'other';

export type RecipeDifficulty = 'easy' | 'medium' | 'hard';

export type FoodUnit = 'g' | 'ml' | 'unit' | 'serving';

/** Macro & micronutrients tracked by the app. All optional except kcal/macros. */
export interface Nutrients {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  caffeine_mg?: number;
}

export const EMPTY_NUTRIENTS: Nutrients = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

export function addNutrients(a: Nutrients, b: Partial<Nutrients>): Nutrients {
  return {
    kcal: a.kcal + (b.kcal ?? 0),
    protein_g: a.protein_g + (b.protein_g ?? 0),
    carbs_g: a.carbs_g + (b.carbs_g ?? 0),
    fat_g: a.fat_g + (b.fat_g ?? 0),
    fiber_g: (a.fiber_g ?? 0) + (b.fiber_g ?? 0),
    sugar_g: (a.sugar_g ?? 0) + (b.sugar_g ?? 0),
    sodium_mg: (a.sodium_mg ?? 0) + (b.sodium_mg ?? 0),
    caffeine_mg: (a.caffeine_mg ?? 0) + (b.caffeine_mg ?? 0),
  };
}

export function scaleNutrients(n: Partial<Nutrients>, factor: number): Nutrients {
  return {
    kcal: (n.kcal ?? 0) * factor,
    protein_g: (n.protein_g ?? 0) * factor,
    carbs_g: (n.carbs_g ?? 0) * factor,
    fat_g: (n.fat_g ?? 0) * factor,
    fiber_g: n.fiber_g != null ? n.fiber_g * factor : undefined,
    sugar_g: n.sugar_g != null ? n.sugar_g * factor : undefined,
    sodium_mg: n.sodium_mg != null ? n.sodium_mg * factor : undefined,
    caffeine_mg: n.caffeine_mg != null ? n.caffeine_mg * factor : undefined,
  };
}

export interface DailyTargets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
}

export interface Profile {
  id: string;
  display_name: string | null;
  language: string;
  country: string | null;
  age: number | null;
  sex: Sex;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: ActivityLevel;
  goal: Goal;
  planning_style: PlanningStyle;
  cooking_skill: CookingSkill;
  cooking_time_minutes: number;
  budget_level: BudgetLevel;
  meals_per_day: number;
  targets_mode: 'automatic' | 'manual';
  onboarding_completed: boolean;
  created_at: string;
}

export interface UserGoalTargets {
  user_id: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  quantity: number;
  unit: FoodUnit;
  location: InventoryLocation;
  source: InventorySource;
  purchase_date: string | null;
  expiry_date: string | null;
  price: number | null;
  nutrients_per_100: Partial<Nutrients> | null;
  barcode: string | null;
  created_at: string;
}

export interface MealItem {
  id: string;
  meal_id: string;
  name: string;
  quantity: number;
  unit: FoodUnit;
  nutrients: Nutrients;
  food_id: string | null;
  recipe_id: string | null;
}

export interface Meal {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  meal_type: MealType;
  logged_at: string;
  note: string | null;
  items: MealItem[];
}

export interface RecipeIngredient {
  id?: string;
  name: string;
  quantity: number;
  unit: FoodUnit;
  nutrients?: Partial<Nutrients> | null;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  steps: string[];
  time_minutes: number | null;
  difficulty: RecipeDifficulty;
  servings: number;
  image_url: string | null;
  tags: string[];
  restrictions: DietaryRestriction[];
  nutrients_per_serving: Nutrients | null;
  ingredients: RecipeIngredient[];
  created_at: string;
}

export interface MealPlanItem {
  id: string;
  plan_id: string;
  date: string;
  meal_type: MealType;
  recipe_id: string | null;
  title: string;
  description: string | null;
  nutrients: Nutrients | null;
  locked: boolean;
  completed: boolean;
}

export interface MealPlan {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'archived';
  items: MealPlanItem[];
}

export interface ShoppingListItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number | null;
  unit: FoodUnit | null;
  category: ShoppingCategory;
  checked: boolean;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: 'open' | 'done';
  created_at: string;
  items: ShoppingListItem[];
}

export interface DailyLogTotals {
  date: string;
  nutrients: Nutrients;
  water_ml: number;
  caffeine_mg: number;
  supplements: string[];
}

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand: string | null;
  unit: FoodUnit;
  serving_size: number | null;
  nutrients_per_100: Partial<Nutrients>;
  source: 'open_food_facts' | 'user' | 'ai';
  verified: boolean;
}

import { useMutation, useQuery } from '@tanstack/react-query';

import { callAiFunction, imageUriToBase64 } from '@/lib/ai/client';
import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { supabase } from '@/lib/supabase/client';
import { recipeDraftSchema, type RecipeDraft } from '@/types/ai';
import type { Nutrients, Recipe, RecipeIngredient } from '@/types/domain';
import { addNutrients, EMPTY_NUTRIENTS, scaleNutrients } from '@/types/domain';

/**
 * Effective per-serving macros for a recipe: the stored value if present,
 * otherwise derived from ingredient nutrients / servings. Returns null when
 * no ingredient carries macros (so callers can show "sin macros").
 */
export function recipeNutrientsPerServing(recipe: Recipe): Nutrients | null {
  if (recipe.nutrients_per_serving) return recipe.nutrients_per_serving;
  const withMacros = (recipe.ingredients ?? []).filter((ing) => ing.nutrients);
  if (withMacros.length === 0) return null;
  const totals = withMacros.reduce((acc, ing) => addNutrients(acc, ing.nutrients ?? {}), EMPTY_NUTRIENTS);
  return scaleNutrients(totals, 1 / Math.max(recipe.servings, 1));
}

export function useRecipes() {
  return useQuery({
    queryKey: queryKeys.recipes,
    queryFn: async (): Promise<Recipe[]> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, ingredients:recipe_ingredients(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Recipe[];
    },
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: queryKeys.recipe(id),
    enabled: id.length > 0,
    queryFn: async (): Promise<Recipe | null> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, ingredients:recipe_ingredients(*)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Recipe | null;
    },
  });
}

export interface RecipeInput {
  name: string;
  description: string | null;
  steps: string[];
  time_minutes: number | null;
  difficulty: Recipe['difficulty'];
  servings: number;
  tags: string[];
  restrictions: Recipe['restrictions'];
  nutrients_per_serving: Recipe['nutrients_per_serving'];
  ingredients: RecipeIngredient[];
}

/** Creation goes through an RPC so recipe + ingredients commit atomically. */
export function useCreateRecipe() {
  return useMutation({
    mutationFn: async (input: RecipeInput): Promise<string> => {
      const { ingredients, ...recipe } = input;
      const { data, error } = await supabase.rpc('create_recipe_with_ingredients', {
        p_recipe: recipe,
        p_ingredients: ingredients,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.recipes }),
  });
}

export function useDeleteRecipe() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.recipes }),
  });
}

export type ImproveGoal =
  | 'healthier'
  | 'more_protein'
  | 'lower_calories'
  | 'cheaper'
  | 'use_inventory'
  | 'adapt_restrictions';

/** AI: returns an improved draft. Nothing is saved until the user confirms. */
export async function improveRecipe(recipeId: string, goal: ImproveGoal): Promise<RecipeDraft> {
  return callAiFunction('improve-recipe', { recipe_id: recipeId, goal }, recipeDraftSchema);
}

/** AI: structure a recipe from free text (pasted or user prompt). */
export async function draftRecipeFromText(
  text: string,
  kind: 'paste' | 'generate',
): Promise<RecipeDraft> {
  return callAiFunction('create-recipe', { text, kind }, recipeDraftSchema);
}

/** AI: structure a recipe from a photo (cookbook page, handwritten note). */
export async function draftRecipeFromPhoto(imageUri: string): Promise<RecipeDraft> {
  const image_base64 = await imageUriToBase64(imageUri);
  return callAiFunction('create-recipe', { image_base64, kind: 'photo' }, recipeDraftSchema);
}

export function draftToInput(draft: RecipeDraft): RecipeInput {
  return {
    name: draft.name,
    description: draft.description ?? null,
    steps: draft.steps,
    time_minutes: draft.time_minutes,
    difficulty: draft.difficulty,
    servings: draft.servings,
    tags: draft.tags,
    restrictions: [],
    nutrients_per_serving: draft.nutrients_per_serving,
    ingredients: draft.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
    })),
  };
}

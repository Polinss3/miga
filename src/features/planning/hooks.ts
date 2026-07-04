import { useMutation, useQuery } from '@tanstack/react-query';

import { callAiFunction } from '@/lib/ai/client';
import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { supabase } from '@/lib/supabase/client';
import {
  mealPlanDraftSchema,
  shoppingListDraftSchema,
  type MealPlanDraft,
  type ShoppingListDraft,
} from '@/types/ai';
import type { MealPlan, ShoppingList } from '@/types/domain';
import { mondayOf } from '@/utils/dates';

export function usePlan(startDate: string) {
  return useQuery({
    queryKey: queryKeys.plan(startDate),
    queryFn: async (): Promise<MealPlan | null> => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*, items:meal_plan_items(*)')
        .eq('start_date', startDate)
        .neq('status', 'archived')
        .maybeSingle();
      if (error) throw error;
      return data as MealPlan | null;
    },
  });
}

/** AI plan generation. Returns a draft; the user reviews before accepting. */
export async function generatePlanDraft(params: {
  startDate: string;
  days: number;
  regenerateMealId?: string;
}): Promise<MealPlanDraft> {
  return callAiFunction(
    'generate-meal-plan',
    {
      start_date: params.startDate,
      days: params.days,
      regenerate_meal_id: params.regenerateMealId ?? null,
    },
    mealPlanDraftSchema,
  );
}

/**
 * Persist an accepted draft through the transactional RPC. The plan is keyed
 * by the Monday of its earliest meal, so a single day generated for next week
 * lands in next week's plan (not the current one).
 */
export function useAcceptPlan() {
  return useMutation({
    mutationFn: async (draft: MealPlanDraft) => {
      const earliest = draft.meals.reduce((min, m) => (m.date < min ? m.date : min), draft.meals[0].date);
      const { error } = await supabase.rpc('accept_meal_plan', {
        p_start_date: mondayOf(earliest),
        p_meals: draft.meals,
      });
      if (error) throw error;
    },
    // Both visible weeks share the 'plan' key prefix — refresh all of them.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] }),
  });
}

/** Link an (AI-generated or manual) recipe to a plan item. */
export function useLinkPlanItemRecipe() {
  return useMutation({
    mutationFn: async ({ itemId, recipeId }: { itemId: string; recipeId: string }) => {
      const { error } = await supabase
        .from('meal_plan_items')
        .update({ recipe_id: recipeId })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] }),
  });
}

export function useTogglePlanItem() {
  return useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: 'locked' | 'completed'; value: boolean }) => {
      const { error } = await supabase
        .from('meal_plan_items')
        .update({ [field]: value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] }),
  });
}

// ── Shopping list ──────────────────────────────────────────────────

export function useShoppingList() {
  return useQuery({
    queryKey: queryKeys.shoppingList,
    queryFn: async (): Promise<ShoppingList | null> => {
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('*, items:shopping_list_items(*)')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ShoppingList | null;
    },
  });
}

/**
 * AI shopping list: reads the week's planned meals + pantry and returns a
 * generous list of real grocery products with realistic quantities. Nothing
 * is saved until {@link useSaveShoppingList} persists the confirmed items.
 */
export async function generateShoppingListDraft(params: {
  startDate: string;
  days: number;
}): Promise<ShoppingListDraft> {
  return callAiFunction(
    'generate-shopping-list',
    { start_date: params.startDate, days: params.days },
    shoppingListDraftSchema,
  );
}

/** Persist a generated shopping list (replaces the current open list). */
export function useSaveShoppingList() {
  return useMutation({
    mutationFn: async (draft: ShoppingListDraft) => {
      const { error } = await supabase.rpc('save_shopping_list', {
        p_plan_id: null,
        p_items: draft.items,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList }),
  });
}

export function useToggleShoppingItem() {
  return useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase.from('shopping_list_items').update({ checked }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList }),
  });
}

/** Close the list and move checked items into the pantry (RPC, atomic). */
export function useFinishShopping() {
  return useMutation({
    mutationFn: async (listId: string): Promise<number> => {
      const { data, error } = await supabase.rpc('finish_shopping', { p_list_id: listId });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList });
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
    },
  });
}

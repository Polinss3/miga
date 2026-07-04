import { useMutation, useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { supabase } from '@/lib/supabase/client';
import { useOfflineQueue } from '@/stores/offline-queue';
import type { DailyTargets, Meal, MealType, Nutrients } from '@/types/domain';
import { addNutrients, EMPTY_NUTRIENTS } from '@/types/domain';
import { DEFAULT_TARGETS } from '@/utils/nutrition';

export interface DayLog {
  meals: Meal[];
  totals: Nutrients;
  waterMl: number;
  caffeineMg: number;
  supplements: string[];
}

export function useTargets() {
  return useQuery({
    queryKey: queryKeys.targets,
    queryFn: async (): Promise<DailyTargets> => {
      const { data, error } = await supabase
        .from('user_goals')
        .select('kcal, protein_g, carbs_g, fat_g, water_ml')
        .maybeSingle();
      if (error) throw error;
      return (data as DailyTargets | null) ?? DEFAULT_TARGETS;
    },
  });
}

export function useDayLog(date: string) {
  return useQuery({
    queryKey: queryKeys.dailyLog(date),
    queryFn: async (): Promise<DayLog> => {
      const [mealsRes, eventsRes] = await Promise.all([
        supabase
          .from('meals')
          .select('*, items:meal_items(*)')
          .eq('date', date)
          .order('logged_at', { ascending: true }),
        supabase.from('log_events').select('kind, value, name').eq('date', date),
      ]);
      if (mealsRes.error) throw mealsRes.error;
      if (eventsRes.error) throw eventsRes.error;

      const meals = (mealsRes.data ?? []) as Meal[];
      let totals = EMPTY_NUTRIENTS;
      for (const meal of meals) {
        for (const item of meal.items ?? []) {
          totals = addNutrients(totals, item.nutrients);
        }
      }

      let waterMl = 0;
      let caffeineMg = 0;
      const supplements: string[] = [];
      for (const event of eventsRes.data ?? []) {
        if (event.kind === 'water') waterMl += event.value ?? 0;
        if (event.kind === 'caffeine') caffeineMg += event.value ?? 0;
        if (event.kind === 'supplement' && event.name) supplements.push(event.name);
      }
      caffeineMg += totals.caffeine_mg ?? 0;

      return { meals, totals, waterMl, caffeineMg, supplements };
    },
  });
}

/** Water logging works offline via the queue; UI updates optimistically. */
export function useLogWater(date: string) {
  const enqueue = useOfflineQueue((s) => s.enqueue);
  return useMutation({
    mutationFn: async (ml: number) => {
      enqueue({
        kind: 'log_water',
        clientId: Crypto.randomUUID(),
        date,
        ml,
        createdAt: new Date().toISOString(),
      });
    },
    onMutate: async (ml) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dailyLog(date) });
      queryClient.setQueryData<DayLog>(queryKeys.dailyLog(date), (old) =>
        old ? { ...old, waterMl: old.waterMl + ml } : old,
      );
    },
  });
}

export function useLogSupplement(date: string) {
  const enqueue = useOfflineQueue((s) => s.enqueue);
  return useMutation({
    mutationFn: async (name: string) => {
      enqueue({
        kind: 'log_supplement',
        clientId: Crypto.randomUUID(),
        date,
        name,
        createdAt: new Date().toISOString(),
      });
    },
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dailyLog(date) });
      queryClient.setQueryData<DayLog>(queryKeys.dailyLog(date), (old) =>
        old ? { ...old, supplements: [...old.supplements, name] } : old,
      );
    },
  });
}

export interface QuickMealInput {
  date: string;
  mealType: MealType;
  name: string;
  quantity: number;
  nutrients: Nutrients;
}

/** Manual meal logging — offline capable. */
export function useQuickLogMeal() {
  const enqueue = useOfflineQueue((s) => s.enqueue);
  return useMutation({
    mutationFn: async (input: QuickMealInput) => {
      enqueue({
        kind: 'log_meal',
        clientId: Crypto.randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(input.date) });
    },
  });
}

export interface ConfirmedMealItem {
  name: string;
  quantity: number;
  unit: string;
  nutrients: Nutrients;
  inventory_item_id?: string | null;
  /** Source links (optional): kept on meal_items for traceability. */
  recipe_id?: string | null;
  food_id?: string | null;
}

/**
 * Structured meal logging (photo analysis, barcode, recipes) — requires
 * connectivity because it can deduct inventory atomically server-side.
 */
export async function addMealWithDeduction(params: {
  date: string;
  mealType: MealType;
  items: ConfirmedMealItem[];
  deductInventory: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('add_meal_with_inventory_deduction', {
    p_client_id: Crypto.randomUUID(),
    p_date: params.date,
    p_meal_type: params.mealType,
    p_items: params.items,
    p_deduct_inventory: params.deductInventory,
  });
  if (error) throw error;
  await queryClient.invalidateQueries({ queryKey: queryKeys.dailyLog(params.date) });
  await queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
}

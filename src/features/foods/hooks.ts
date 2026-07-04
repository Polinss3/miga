import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { supabase } from '@/lib/supabase/client';
import type { FoodUnit, Nutrients } from '@/types/domain';

/** Row from the global read-only `foods` catalog (per 100 g/ml). */
export interface CatalogFood {
  id: string;
  name: string;
  name_es: string | null;
  unit: FoodUnit;
  nutrients_per_100: Partial<Nutrients>;
  verified: boolean;
}

export function foodDisplayName(food: CatalogFood, language: string): string {
  return language.startsWith('es') && food.name_es ? food.name_es : food.name;
}

/** Search the foods catalog by name (both languages). */
export function useFoodSearch(query: string) {
  // Strip PostgREST filter syntax characters so free text can't break the .or() expression.
  const q = query.trim().replace(/[,()%]/g, ' ').replace(/\s+/g, ' ').trim();
  return useQuery({
    queryKey: queryKeys.foodSearch(q.toLowerCase()),
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CatalogFood[]> => {
      const { data, error } = await supabase
        .from('foods')
        .select('id, name, name_es, unit, nutrients_per_100, verified')
        .or(`name.ilike.%${q}%,name_es.ilike.%${q}%`)
        .order('verified', { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as CatalogFood[];
    },
  });
}

/** A searchable food or branded product, normalized to one shape. */
export interface FoodResult {
  key: string;
  name: string;
  brand: string | null;
  unit: FoodUnit;
  nutrients_per_100: Partial<Nutrients>;
  /** 'catalog' = generic ingredient · 'product' = branded/scanned item. */
  kind: 'catalog' | 'product';
}

/**
 * MyFitnessPal-style ingredient search. Runs through the `search-foods` Edge
 * Function, which merges our catalog with a live Open Food Facts search (and
 * caches hits), so almost any real product is findable. Results are per 100 g/ml.
 */
export function useIngredientSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: [...queryKeys.foodSearch(q.toLowerCase()), 'ingredients'],
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FoodResult[]> => {
      const { data, error } = await supabase.functions.invoke('search-foods', { body: { query: q } });
      if (error) throw error;
      const results = (data?.results ?? []) as FoodResult[];
      return results;
    },
  });
}

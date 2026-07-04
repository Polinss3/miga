import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { supabase } from '@/lib/supabase/client';

export interface WeightEntry {
  id: string;
  date: string;
  weight_kg: number;
  source: 'manual' | 'apple_health' | 'health_connect';
}

export function useWeightLog(limit = 30) {
  return useQuery({
    queryKey: queryKeys.weightLog,
    queryFn: async (): Promise<WeightEntry[]> => {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('id, date, weight_kg, source')
        .order('date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as WeightEntry[];
    },
  });
}

export function useLogWeight() {
  return useMutation({
    mutationFn: async ({ weightKg, date }: { weightKg: number; date: string }) => {
      const { error } = await supabase
        .from('weight_logs')
        .upsert({ date, weight_kg: weightKg, source: 'manual' }, { onConflict: 'user_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.weightLog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

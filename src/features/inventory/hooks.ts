import { useMutation, useQuery } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { supabase } from '@/lib/supabase/client';
import type { InventoryItem } from '@/types/domain';

export function useInventory() {
  return useQuery({
    queryKey: queryKeys.inventory,
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .gt('quantity', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });
}

export type NewInventoryItem = Omit<InventoryItem, 'id' | 'user_id' | 'created_at'>;

export function useAddInventoryItem() {
  return useMutation({
    mutationFn: async (item: Partial<NewInventoryItem> & { name: string }) => {
      const { error } = await supabase.from('inventory_items').insert(item);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
  });
}

export function useUpdateInventoryItem() {
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<InventoryItem> & { id: string }) => {
      const { error } = await supabase.from('inventory_items').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
  });
}

export function useDeleteInventoryItem() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory }),
  });
}

/** Items expiring in the next `withinDays` days (default 4). */
export function expiringSoon(items: InventoryItem[], withinDays = 4): InventoryItem[] {
  const limit = new Date();
  limit.setDate(limit.getDate() + withinDays);
  const limitKey = limit.toISOString().slice(0, 10);
  return items.filter((item) => item.expiry_date != null && item.expiry_date <= limitKey);
}

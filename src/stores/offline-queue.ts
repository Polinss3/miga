import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { queryClient } from '@/lib/query/client';
import { supabase } from '@/lib/supabase/client';
import type { MealType, Nutrients } from '@/types/domain';

/**
 * Conservative offline queue.
 *
 * Only simple, append-only logs can be recorded offline (meals typed by hand,
 * water, supplements). Compound operations (AI, inventory deduction, plans)
 * require connectivity by design. Each op carries a client-generated UUID that
 * the RPC uses for idempotent inserts, so a retry after a half-failed flush
 * can never duplicate a meal.
 */

export type PendingOp =
  | {
      kind: 'log_meal';
      clientId: string;
      date: string;
      mealType: MealType;
      name: string;
      quantity: number;
      nutrients: Nutrients;
      createdAt: string;
    }
  | { kind: 'log_water'; clientId: string; date: string; ml: number; createdAt: string }
  | { kind: 'log_supplement'; clientId: string; date: string; name: string; createdAt: string };

interface OfflineQueueState {
  queue: PendingOp[];
  flushing: boolean;
  enqueue: (op: PendingOp) => void;
  flush: () => Promise<void>;
}

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      flushing: false,

      enqueue: (op) => {
        set((state) => ({ queue: [...state.queue, op] }));
        // Try immediately — enqueue is also used while online.
        void get().flush();
      },

      flush: async () => {
        const { queue, flushing } = get();
        if (flushing || queue.length === 0) return;
        const online = (await NetInfo.fetch()).isConnected;
        if (!online) return;

        set({ flushing: true });
        try {
          const remaining: PendingOp[] = [];
          for (const op of queue) {
            const ok = await executeOp(op);
            if (!ok) remaining.push(op);
          }
          set({ queue: remaining });
          if (remaining.length < queue.length) {
            // Something landed — refresh today's data.
            void queryClient.invalidateQueries({ queryKey: ['meals'] });
            void queryClient.invalidateQueries({ queryKey: ['dailyLog'] });
          }
        } finally {
          set({ flushing: false });
        }
      },
    }),
    {
      name: 'miga.offline-queue',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ queue: state.queue }) as OfflineQueueState,
    },
  ),
);

async function executeOp(op: PendingOp): Promise<boolean> {
  try {
    if (op.kind === 'log_meal') {
      const { error } = await supabase.rpc('add_meal_with_inventory_deduction', {
        p_client_id: op.clientId,
        p_date: op.date,
        p_meal_type: op.mealType,
        p_items: [
          {
            name: op.name,
            quantity: op.quantity,
            unit: 'g',
            nutrients: op.nutrients,
          },
        ],
        p_deduct_inventory: false,
      });
      return !error;
    }
    if (op.kind === 'log_water') {
      const { error } = await supabase.rpc('log_water', {
        p_client_id: op.clientId,
        p_date: op.date,
        p_ml: op.ml,
      });
      return !error;
    }
    const { error } = await supabase.rpc('log_supplement', {
      p_client_id: op.clientId,
      p_date: op.date,
      p_name: op.name,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Flush whenever connectivity returns. Called once from the root layout. */
export function setupOfflineQueueFlush(): void {
  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void useOfflineQueue.getState().flush();
    }
  });
}

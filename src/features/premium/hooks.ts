import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { hasPremiumEntitlement, isPurchasesAvailable } from '@/lib/revenuecat';
import { supabase } from '@/lib/supabase/client';

export interface PremiumStatus {
  isPremium: boolean;
  /** Free AI actions left this month (only meaningful when not premium). */
  freeQuotaLeft: number;
  purchasesAvailable: boolean;
}

/**
 * Premium status for UI gating only. The backend independently re-validates
 * entitlements (subscriptions table + quota) before running AI operations —
 * never trust this value for anything but showing/hiding paywalls.
 */
export function usePremium() {
  return useQuery({
    queryKey: queryKeys.subscription,
    staleTime: 60_000,
    queryFn: async (): Promise<PremiumStatus> => {
      const [rcEntitlement, quotaRes, subRes] = await Promise.all([
        hasPremiumEntitlement(),
        supabase.rpc('get_ai_quota_left'),
        supabase.from('subscriptions').select('status, period_end').maybeSingle(),
      ]);

      const serverPremium =
        subRes.data?.status === 'active' &&
        (subRes.data.period_end == null || new Date(subRes.data.period_end) > new Date());

      return {
        isPremium: rcEntitlement || serverPremium,
        freeQuotaLeft: typeof quotaRes.data === 'number' ? quotaRes.data : 0,
        purchasesAvailable: isPurchasesAvailable(),
      };
    },
  });
}

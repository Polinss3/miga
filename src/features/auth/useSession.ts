import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { configurePurchases, logOutPurchases } from '@/lib/revenuecat';
import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { supabase } from '@/lib/supabase/client';
import type { Profile } from '@/types/domain';

interface SessionState {
  session: Session | null;
  initializing: boolean;
}

/** Auth session with live updates. Also wires RevenueCat identity. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, initializing: true });

  useEffect(() => {
    let mounted = true;

    // getSession reads the locally stored session. A `.catch` is essential:
    // if it ever rejects, `initializing` must still flip to false, otherwise
    // the splash gate in the root layout would hang forever.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (__DEV__) console.log('[boot] getSession ok, session:', !!data.session);
        if (!mounted) return;
        setState({ session: data.session, initializing: false });
        if (data.session) void configurePurchases(data.session.user.id);
      })
      .catch((error) => {
        console.warn('[boot] getSession failed:', error?.message ?? error);
        if (mounted) setState({ session: null, initializing: false });
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({ session, initializing: false });
      if (session) {
        void configurePurchases(session.user.id);
      } else {
        void logOutPurchases();
        queryClient.clear();
      }
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: queryKeys.profile,
    enabled,
    queryFn: async (): Promise<Profile | null> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

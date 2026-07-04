import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'missing_supabase_config: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not embedded in this build.',
    );
  }
}

if (!isSupabaseConfigured) {
  // Warn loudly at startup and let feature entry points throw clearer errors.
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.',
  );
}

/**
 * Session persistence uses AsyncStorage (the Supabase-documented default for
 * Expo). The anon key is public by design; row access is enforced by RLS.
 * See docs/architecture.md for the SecureStore-encrypted upgrade path.
 */
export const supabase = createClient(supabaseUrl ?? 'https://missing-supabase-url.invalid', supabaseAnonKey ?? 'anon', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh auth tokens only while the app is foregrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

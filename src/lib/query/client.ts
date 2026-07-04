import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

/**
 * React Query is the single source of truth for remote data.
 * The cache is persisted to AsyncStorage so the main screens
 * (Today, Pantry, Recipes, Plan) render instantly offline.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24, // keep a day of cache for offline use
      retry: 2,
    },
    mutations: {
      retry: 1,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'miga.query-cache',
  throttleTime: 2000,
});

/** Wire RQ's online state to NetInfo and focus state to AppState. */
export function setupQueryManagers(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    }),
  );

  AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') {
      focusManager.setFocused(status === 'active');
    }
  });
}

import 'react-native-url-polyfill/auto';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { router, Stack, type ErrorBoundaryProps, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useProfile, useSession } from '@/features/auth/useSession';
import { initI18nSync, loadStoredLanguage } from '@/lib/i18n';
import { queryClient, queryPersister, setupQueryManagers } from '@/lib/query/client';
import { setupOfflineQueueFlush } from '@/stores/offline-queue';

export const unstable_settings = {
  anchor: 'index',
};

// ── Boot diagnostics (temporary — remove once startup is confirmed) ──
console.log('[boot] root layout module evaluating');
if (__DEV__) {
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler?: () => unknown; setGlobalHandler?: (h: (e: Error, f: boolean) => void) => void };
  };
  const prev = g.ErrorUtils?.getGlobalHandler?.() as ((e: Error, f: boolean) => void) | undefined;
  g.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    console.error('[boot] UNCAUGHT', isFatal ? '(fatal)' : '', error?.message, '\n', error?.stack);
    prev?.(error, isFatal);
  });
}

SplashScreen.preventAutoHideAsync().catch(() => {});

try {
  setupQueryManagers();
  setupOfflineQueueFlush();
  initI18nSync(); // synchronous — ready before first render, no gate to hang on
  console.log('[boot] setup done (i18n ready)');
} catch (error) {
  console.error('[boot] setup failed:', error);
}

/** Expo Router error boundary — shows render errors on screen instead of a blank splash. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#1b0000', padding: 24, paddingTop: 80 }}>
      <Text style={{ color: '#ff8080', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>App crash</Text>
      <ScrollView style={{ flex: 1 }}>
        <Text selectable style={{ color: '#fff', fontSize: 13 }}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </Text>
      </ScrollView>
      <Text onPress={retry} style={{ color: '#8fb8ff', fontSize: 17, marginTop: 16 }}>
        Tap to retry
      </Text>
    </View>
  );
}

export default function RootLayout() {
  if (__DEV__) console.log('[boot] RootLayout render');

  // i18n is initialized synchronously at module load (initI18nSync above), so
  // there is no async gate here that could hang the splash. We only apply the
  // saved language override in the background.
  useEffect(() => {
    console.log('[boot] RootLayout mounted');
    void loadStoredLanguage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24 }}
      >
        <RootNavigator />
        <ThemedStatusBar />
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStatusBar() {
  const scheme = useColorScheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootNavigator() {
  const pathname = usePathname();
  const { session, initializing } = useSession();
  const { data: profile, isLoading: profileLoading } = useProfile(!!session);

  // Safety net: never let an unresolved async call keep the splash up forever.
  // After the timeout we proceed with whatever state we have (worst case, the
  // sign-in screen), so the app can't get stuck on a blank splash.
  const [bootTimedOut, setBootTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (__DEV__) console.warn('[boot] timed out waiting for session/profile — proceeding');
      setBootTimedOut(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  const waitingForProfile = !!session && profileLoading;
  const ready = bootTimedOut || (!initializing && !waitingForProfile);
  const signedIn = !!session;
  const onboarded = !!profile?.onboarding_completed;

  useEffect(() => {
    if (__DEV__)
      console.log('[boot] gate:', { initializing, hasSession: signedIn, profileLoading, ready, pathname });
    if (ready) {
      requestAnimationFrame(() => {
        SplashScreen.hideAsync()
          .then(() => console.log('[boot] splash hidden ✅ — app should be visible now'))
          .catch((error) => console.warn('[boot] hideAsync failed:', error?.message ?? error));
      });
    }
  }, [ready, initializing, signedIn, profileLoading, pathname]);

  useEffect(() => {
    if (!ready || pathname === '/auth/callback') return;

    let nextPath: '/sign-in' | '/onboarding' | '/today' | null = null;
    if (!signedIn && pathname !== '/sign-in') {
      nextPath = '/sign-in';
    } else if (signedIn && !onboarded && pathname !== '/onboarding') {
      nextPath = '/onboarding';
    } else if (signedIn && onboarded && ['/', '/sign-in', '/onboarding'].includes(pathname)) {
      nextPath = '/today';
    }
    if (!nextPath) return;

    if (__DEV__) console.log('[boot] redirect:', pathname, '->', nextPath);
    router.replace(nextPath);
  }, [ready, signedIn, onboarded, pathname]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
      <Stack.Screen name="ai" options={{ presentation: 'modal' }} />
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}

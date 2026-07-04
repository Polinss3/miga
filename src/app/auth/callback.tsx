import { Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';

import { createSessionFromUrl } from '@/features/auth/service';
import { LoadingState, Screen } from '@/components/ui';

/**
 * Magic-link landing route. The root layout redirects to the right place
 * once the session exists; this screen just exchanges the URL for a session.
 */
export default function AuthCallback() {
  const url = Linking.useURL();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (url) {
      createSessionFromUrl(url).catch(() => setFailed(true));
    }
  }, [url]);

  if (failed) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen scroll={false}>
      <LoadingState />
    </Screen>
  );
}

import { Platform } from 'react-native';

import appleHealthProvider from './apple-health';
import healthConnectProvider from './health-connect';
import { noopHealthProvider } from './noop';
import type { HealthProvider } from './types';

export * from './types';

/**
 * Returns the best health provider for this platform/build.
 *
 * apple-health.ts and health-connect.ts export `null` until the native
 * libraries are installed (EAS development build required) — see
 * docs/health-integrations.md for the exact activation steps. Until then
 * the no-op provider is used and the UI explains the limitation.
 */
export function getHealthProvider(): HealthProvider {
  if (Platform.OS === 'ios' && appleHealthProvider) return appleHealthProvider;
  if (Platform.OS === 'android' && healthConnectProvider) return healthConnectProvider;
  return noopHealthProvider;
}

import type { HealthProvider } from './types';

/**
 * Android Health Connect provider — template.
 *
 * Activation (requires an EAS development build, see docs/health-integrations.md):
 *  1. `npx expo install react-native-health-connect` and add the required
 *     permissions to app.config.ts (android.permissions + health permissions
 *     in the manifest via the library's config plugin).
 *  2. Replace the `null` export below with `createHealthConnectProvider()`.
 */

// Uncomment after installing react-native-health-connect:
//
// import { initialize, requestPermission, readRecords, insertRecords } from 'react-native-health-connect';
//
// export function createHealthConnectProvider(): HealthProvider { ... }

const healthConnectProvider: HealthProvider | null = null;

export default healthConnectProvider;

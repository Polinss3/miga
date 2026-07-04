import type { HealthProvider } from './types';

/**
 * HealthKit provider — template.
 *
 * Activation (requires an EAS development build, see docs/health-integrations.md):
 *  1. `npx expo install react-native-health` and add its config plugin to app.config.ts.
 *  2. Replace the `null` export below with `createAppleHealthProvider()`.
 *
 * The implementation is kept ready so wiring HealthKit is a 30-minute task,
 * not a design exercise. Permission strings are already localized in
 * assets/locales/*.json (NSHealthShareUsageDescription / NSHealthUpdateUsageDescription).
 */

// Uncomment after installing react-native-health:
//
// import AppleHealthKit, { type HealthKitPermissions } from 'react-native-health';
//
// const PERMISSION_MAP = {
//   read_weight: AppleHealthKit.Constants.Permissions.Weight,
//   read_steps: AppleHealthKit.Constants.Permissions.StepCount,
//   read_workouts: AppleHealthKit.Constants.Permissions.Workout,
//   read_active_energy: AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
//   write_nutrition: AppleHealthKit.Constants.Permissions.EnergyConsumed,
//   write_water: AppleHealthKit.Constants.Permissions.Water,
// } as const;
//
// export function createAppleHealthProvider(): HealthProvider { ... }

const appleHealthProvider: HealthProvider | null = null;

export default appleHealthProvider;

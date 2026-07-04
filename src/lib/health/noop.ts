import type { HealthProvider } from './types';

/** Used in Expo Go, on web, or before the native health libraries are added. */
export const noopHealthProvider: HealthProvider = {
  platformName: 'none',
  isAvailable: async () => false,
  requestPermissions: async () => false,
  readLatestWeight: async () => null,
  readTodaySteps: async () => null,
  readTodayActiveEnergy: async () => null,
  readRecentWorkouts: async () => [],
  writeNutrition: async () => false,
  writeWater: async () => false,
};

/**
 * Provider-agnostic health integration layer.
 *
 * Concrete implementations (HealthKit via react-native-health, Health Connect
 * via react-native-health-connect) require an EAS development build and are
 * activated by installing the library — see docs/health-integrations.md.
 * Until then the app uses the no-op provider and the UI explains why.
 */

export type HealthPermission =
  | 'read_weight'
  | 'read_steps'
  | 'read_workouts'
  | 'read_active_energy'
  | 'write_nutrition'
  | 'write_water';

export interface WeightSample {
  date: string; // ISO
  weightKg: number;
}

export interface WorkoutSample {
  date: string;
  type: string;
  durationMinutes: number;
  activeEnergyKcal: number | null;
}

export interface NutritionWrite {
  date: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface HealthProvider {
  readonly platformName: 'apple_health' | 'health_connect' | 'none';
  isAvailable(): Promise<boolean>;
  requestPermissions(permissions: HealthPermission[]): Promise<boolean>;
  readLatestWeight(): Promise<WeightSample | null>;
  readTodaySteps(): Promise<number | null>;
  readTodayActiveEnergy(): Promise<number | null>;
  readRecentWorkouts(days: number): Promise<WorkoutSample[]>;
  writeNutrition(entry: NutritionWrite): Promise<boolean>;
  writeWater(date: string, ml: number): Promise<boolean>;
}

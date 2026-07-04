# Miga — Apple Health & Health Connect

## Status
Architecture-complete, activation-gated on an EAS development build.
The app compiles and runs without the native health libraries: the
`HealthProvider` interface (`src/lib/health/types.ts`) falls back to a no-op
provider and the Health screen explains the limitation.

Ready today:
- `HealthProvider` interface: weight, steps, workouts, active energy (read);
  nutrition, water (write) — with granular `HealthPermission` scopes.
- Localized iOS permission strings (`assets/locales/*.json`).
- `health_connections` (per-platform consent record) and `health_samples` tables,
  plus the `delete_health_data()` RPC (user-invocable erasure).
- UI: Profile → Health sync with plain-language permission explainer,
  connect/disconnect and data deletion.

## Why not in Expo Go
HealthKit and Health Connect are native frameworks; Expo Go cannot load them.
Both libraries require a development build (`eas build --profile development`).

## Activate Apple Health (iOS)
1. `npx expo install react-native-health`
2. app.config.ts → `plugins`: add `'react-native-health'` and set
   `ios.entitlements['com.apple.developer.healthkit'] = true`.
3. Implement `createAppleHealthProvider()` in `src/lib/health/apple-health.ts`
   (skeleton + permission map already sketched there) and export it instead of null.
4. `eas build --profile development --platform ios`.

## Activate Health Connect (Android)
1. `npx expo install react-native-health-connect`
2. app.config.ts → add the library's config plugin; it injects the
   `android.permission.health.*` permissions matching our scopes.
3. Implement `createHealthConnectProvider()` in `src/lib/health/health-connect.ts`.
4. `eas build --profile development --platform android`.
5. Play release: complete the Health apps declaration (see app-store-compliance.md).

## Sync design (when activated)
- **Read** weight/steps/workouts/energy on Today focus; store daily aggregates in
  `health_samples` (upsert on user/date/kind). Workouts adjust the daily energy
  target display, never the stored base target.
- **Write** nutrition/water after each confirmed log, guarded by the granted
  scopes in `health_connections.permissions`.
- Disconnect stops sync immediately; "Delete synced health data" erases
  `health_samples` and non-manual `weight_logs`.
- Health data never feeds marketing/analytics (see privacy.md).

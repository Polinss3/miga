# Miga — Privacy & GDPR

## Principles
1. Store the minimum needed for the product to work.
2. Health data is never used for marketing, advertising or commercial profiling.
3. Images are transient: analyzed, then deleted.
4. The user can export and erase everything, at any time, from the app.

## Data inventory

| Data | Where | Purpose | Retention |
|---|---|---|---|
| Email, auth identities | Supabase Auth | Sign-in, account linking | Until account deletion |
| Profile (name, age, sex*, height, weight, goals) | `profiles`, `user_goals` | Nutrition targets | Until deletion |
| Diet restrictions, allergies, dislikes | `dietary_preferences`, `allergies` | Personalization & safety | Until deletion |
| Meals, water, caffeine, supplements, weight | `meals*`, `log_events`, `weight_logs` | Core tracking | Until deletion |
| Pantry, recipes, plans, shopping lists | respective tables | Core features | Until deletion |
| Receipt structured data (store, items, prices) | `scanned_receipts*` | Pantry automation | Until deletion |
| AI audit (kind, status, validated JSON result) | `ai_requests`, `ai_results` | Abuse control, debugging | Until deletion |
| Subscription status | `subscriptions` | Premium entitlement | Until deletion |
| Health samples (steps, energy, workouts) | `health_samples` | Target adjustment | User-erasable separately |

\* Biological sex is optional and used only for calorie math.

## Images (meals, receipts, labels)
- Captured with EXIF disabled (no location metadata).
- Sent base64 to an Edge Function, processed in memory by the AI provider,
  **never written to storage or database**.
- The local copy is deleted immediately after analysis
  (`deleteLocalImage` in `src/features/scan/usePhotoCapture.ts`).
- Only user-confirmed structured data is persisted.

## AI providers as processors
Images and prompt context are sent to the configured AI provider (OpenAI, Anthropic
or Google) strictly to produce the requested analysis. Before production launch:
sign the provider's DPA, disable training on API data (default on these APIs), and
list the provider as a sub-processor in the public privacy policy.

## GDPR rights implementation
- **Access/portability**: "Export my data" (Profile) — v1 surfaces the request;
  automate as a follow-up with a signed URL export.
- **Erasure**: "Delete account & data" calls the `delete-account` Edge Function →
  `auth.admin.deleteUser()` → every table cascades (all FKs are ON DELETE CASCADE).
  Health data alone can be erased via `delete_health_data()`.
- **Consent granularity**: camera, photos and health permissions are requested in
  context with plain-language explanations (localized in `assets/locales/`).
- **Lawful basis**: contract performance for core features; consent for health sync.

## What we deliberately do NOT do
- No third-party analytics or ads SDKs (none installed).
- No selling or sharing of personal data.
- No health data in any future analytics/crash reporting.
- No storing of receipt or food images.

## Disclaimers
The app shows, at onboarding and in Profile → Privacy, in both languages:
Miga provides general nutrition guidance and estimates; it is not a medical
device and does not replace a doctor, registered dietitian or professional
diagnosis. See `legal.medicalDisclaimerBody` in the locale files.

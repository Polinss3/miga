# Miga — Architecture

## Overview

Miga is an Expo (SDK 54) + React Native + TypeScript app with a Supabase backend
(Auth, Postgres + strict RLS, RPCs, Edge Functions) and a provider-agnostic AI layer.
The experience is screens-first: closed flows for scanning, logging, recipes and
planning; the AI advisor chat is a helper, not the product.

```
┌─────────────── App (Expo / React Native) ───────────────┐
│ src/app        Expo Router routes (auth gate, tabs)      │
│ src/features   domain services + React Query hooks       │
│ src/lib        supabase · query · i18n · ai · rc · health│
│ src/stores     zustand (offline queue, settings, drafts) │
│ src/components UI kit (Liquid Glass, HIG-styled)         │
└───────────────┬──────────────────────────────────────────┘
                │ supabase-js (anon key + JWT, RLS enforced)
┌───────────────▼──────────────────────────────────────────┐
│ Supabase                                                  │
│  Auth (magic link, Apple, Google — auto-linked by email)  │
│  Postgres: strict RLS, SECURITY DEFINER RPCs              │
│  Edge Functions: AI flows, OFF lookup, RC webhook, GDPR   │
│     └── _shared/ai: OpenAI | Anthropic | Gemini adapters  │
└──────────────────────────────────────────────────────────┘
```

## Key decisions

### Navigation: 5 tabs + 2 modal sections
The brief lists 7 sections. Apple HIG caps comfortable tab bars at 5, so the tab bar
holds **Today, Scan, Pantry, Recipes, Plan**; **Profile** opens from the avatar in the
Today header (App Store / Fitness pattern) and the **AI Advisor** opens modally from
Today's quick actions. All 7 sections exist as first-class routes.

### Auth & account linking
- Magic link (deep link `miga://auth/callback`), Apple Sign In (native
  `signInWithIdToken` + nonce), Google (OAuth PKCE via system browser).
- Expo Go uses temporary `exp://.../--/auth/callback` redirects; Supabase must
  allow `exp://**` during development. Development/production builds use the
  stable `miga://auth/callback` scheme.
- **Same email ⇒ same account**: enable *Authentication → Providers →
  "Link identities automatically"* in the Supabase dashboard. Apple and Google
  emails are verified, and magic links prove ownership, so linking is safe.
- A DB trigger provisions `profiles`, `user_goals`, `dietary_preferences` and
  `user_settings` on signup; the root layout routes to onboarding until
  `profiles.onboarding_completed` is true.

### Data layer
- **React Query** owns all remote state; the cache persists to AsyncStorage so
  Today/Pantry/Recipes/Plan render instantly offline (24 h maxAge).
- **Zustand** holds only local state: onboarding draft, lightweight settings and
  the offline queue.
- Query keys are centralized in `src/lib/query/keys.ts`.

### Offline strategy (conservative by design)
Only append-only logs work offline: manual meals, water, supplements. Each op gets a
client UUID; RPCs insert with `ON CONFLICT (client_id) DO NOTHING`, so flush retries
can never duplicate. Compound operations (AI, inventory deduction, plans, shopping)
require connectivity. The queue flushes on NetInfo reconnect and shows a
"pending sync" banner on Today.

### Security model
- RLS on every table; owner-only via `auth.uid()`.
- Global catalogs (`foods`, `branded_products`, `barcode_products`): read-only for
  authenticated users; writes only via Edge Functions (service role).
- No client INSERT on: meals, recipes, plans, shopping lists, receipts,
  ai_requests/results, subscriptions, log_events. These go through SECURITY DEFINER
  RPCs that validate and scope to `auth.uid()`.
- Column-level grants: clients can only UPDATE `meal_plan_items.locked/completed`
  and `shopping_list_items.checked`.
- Premium enforcement is server-side: every AI Edge Function calls
  `consume_ai_quota_if_needed()` (premium bypass or free-quota decrement) before
  touching a model. The client `PremiumGate` is presentation only.
- Auth session persists in AsyncStorage (Supabase's documented Expo default; the anon
  key is public by design and RLS is the boundary). Upgrade path if desired: encrypt
  the session with a SecureStore-held key (Supabase "LargeSecureStore" pattern).

### AI layer (`supabase/functions/_shared/ai`)
- `AiProvider` interface with adapters for **OpenAI** (also any OpenAI-compatible
  endpoint via `OPENAI_BASE_URL`), **Anthropic** and **Gemini**. Selection via
  secrets: `AI_PROVIDER` + `AI_MODEL` — switching providers is config, not code.
- All calls are multimodal-capable (text + base64 images) and request JSON output.
- Responses are validated with zod **server-side** (`_shared/schemas.ts`) and again
  client-side (`src/types/ai.ts`). Invalid output never reaches the DB or the UI.
- Every request is audited in `ai_requests`/`ai_results` (never image data).
- Nothing the AI produces is persisted without explicit user confirmation.

### Payments
- **RevenueCat** is the only in-app payment path (App Store / Play compliant).
  `react-native-purchases` needs a development build; the wrapper degrades to
  free-tier behavior in Expo Go.
- The `revenuecat-webhook` Edge Function maintains the `subscriptions` table — the
  server-side source of truth (`is_premium()` SQL function).
- **Stripe (future web portal)**: nothing to change in the schema — a future
  `stripe-webhook` function would upsert the same `subscriptions` row with
  `store='stripe'`. Do not use Stripe for in-app digital subscriptions.

### Health integrations
Architecture-complete, implementation-gated on a dev build: `HealthProvider`
interface + no-op fallback, permission strings localized, `health_connections` /
`health_samples` tables and `delete_health_data()` RPC ready.
See [health-integrations.md](./health-integrations.md) for activation steps.

### Observability (future)
No Sentry/analytics yet by request. Insertion points when the time comes:
- `src/app/_layout.tsx` — SDK init + navigation instrumentation.
- `src/lib/query/client.ts` — query/mutation error hooks.
- Edge Functions `_shared/http.ts` — server-side error reporting.
Keep events strictly non-health-data (see privacy.md).

## Expo Go vs development build

| Feature | Expo Go | Dev build (EAS) |
|---|---|---|
| Auth (magic link, Google OAuth) | ✅ | ✅ |
| Apple Sign In | ✅ (iOS) | ✅ |
| Camera + barcode scanning | ✅ | ✅ |
| AI flows (photo/receipt/label/plan/chat) | ✅ | ✅ |
| Liquid Glass (`expo-glass-effect`) | ✅ iOS 26+ | ✅ iOS 26+ (blur fallback otherwise) |
| RevenueCat purchases | ❌ free-tier behavior | ✅ |
| HealthKit / Health Connect | ❌ no-op provider | ✅ after installing libs |

## Testing
- Unit tests (Jest, plain Node env + babel-preset-expo): nutrition math
  (BMR/TDEE/macros), unit normalization, AI schema hallucination guards.
  Run `npm test`. Component tests would need a separate `jest-expo` project.
- The critical server logic lives in SQL RPCs — exercise them with
  `supabase test db` or pgTAP as a follow-up.

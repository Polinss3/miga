# Miga — agent notes

Expo SDK 54 + TypeScript strict + Expo Router (routes in `src/app/`, not root `app/`).
Backend: Supabase (migrations/RPCs/Edge Functions under `supabase/`).

## Commands
- `npm run typecheck` · `npm test` · `npm run lint`
- Edge Functions are Deno (excluded from tsconfig); check them with
  `deno check supabase/functions/**/index.ts` if Deno is installed.
- Deploy functions with `supabase functions deploy --import-map supabase/functions/import_map.json`
  (the CLI bundler ignores `functions/deno.json`, so the explicit import map is required).
- Ad-hoc SQL against the linked remote DB: `supabase db query --linked "..."`.
- New routes need regenerated typed routes before `typecheck` passes: briefly run
  `npx expo start --offline` (updates `.expo/types/router.d.ts`).

## Hard rules
- All user-visible text via i18n keys in `src/lib/i18n/locales/{en,es}.json` — add
  both languages for every new key.
- Client never writes critical tables directly (meals, recipes, plans, lists,
  receipts, subscriptions, ai_*): use the SECURITY DEFINER RPCs; new compound
  writes get a new RPC + RLS review.
- AI output must validate against zod schemas in BOTH `src/types/ai.ts` (client)
  and `supabase/functions/_shared/schemas.ts` (server) — keep them in sync.
- Premium/quota enforcement lives server-side (`authorizeAiRequest`); the client
  `PremiumGate` is UI only.
- Scan images are deleted after processing (`deleteLocalImage`); never persist them.
- Native-module code (RevenueCat, health) must degrade gracefully in Expo Go —
  guarded require / null-provider patterns already in `src/lib/revenuecat` and
  `src/lib/health`.

## Domain naming
Meal types: breakfast|lunch|dinner|snack|flexible. Units: g|ml|unit|serving.
Day keys: `YYYY-MM-DD` via `dayKey()` in `src/utils/dates.ts`.
Nutrients shape: `{ kcal, protein_g, carbs_g, fat_g, fiber_g?, sugar_g?, sodium_mg?, caffeine_mg? }`.

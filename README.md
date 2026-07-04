# Miga 🥗

Nutrition companion app: daily food tracking, barcode/receipt/meal-photo scanning,
pantry inventory, personal recipes, AI meal planning and a safety-bounded AI advisor.
Spanish + English, iOS-first (Liquid Glass on iOS 26+), Android compatible.

**Stack**: Expo SDK 54 · React Native · TypeScript strict · Expo Router ·
Supabase (Auth, Postgres + RLS, RPC, Edge Functions) · TanStack Query · Zustand ·
RevenueCat · provider-agnostic AI (OpenAI / Anthropic / Gemini).

Docs: [architecture](docs/architecture.md) · [privacy/GDPR](docs/privacy.md) ·
[AI safety](docs/ai-safety.md) · [store compliance](docs/app-store-compliance.md) ·
[health integrations](docs/health-integrations.md)

---

## 1. Prerequisites
- Node 20+, npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- Xcode / Android Studio for simulators, or the Expo Go app
- Accounts: Supabase, an AI provider (OpenAI/Anthropic/Google), RevenueCat (for premium), Expo/EAS (for builds)

## 2. Backend setup (Supabase)

```bash
# Create a project at supabase.com, then:
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # applies supabase/migrations (schema, RLS, RPCs)
psql "$DATABASE_URL" -f supabase/seed.sql   # optional: base food catalog

# AI + webhook secrets (server-side only):
supabase secrets set AI_PROVIDER=openai AI_MODEL=gpt-5-nano OPENAI_API_KEY=sk-...
# or: AI_PROVIDER=anthropic AI_MODEL=claude-haiku-4-5 ANTHROPIC_API_KEY=...
# or: AI_PROVIDER=gemini    AI_MODEL=gemini-2.5-flash  GOOGLE_AI_API_KEY=...
supabase secrets set REVENUECAT_WEBHOOK_AUTH=$(openssl rand -hex 24)

# Deploy Edge Functions:
supabase functions deploy analyze-food-image analyze-receipt-image \
  analyze-nutrition-label create-recipe improve-recipe generate-meal-plan \
  ai-chat normalize-barcode-product delete-account
supabase functions deploy revenuecat-webhook --no-verify-jwt
```

Dashboard configuration:
1. **Auth → Providers**: enable Email (magic link), Apple, Google. Turn ON
   *"Link identities automatically"* so the same email maps to one account.
2. **Auth → URL Configuration**:
   - Site URL: `miga://auth/callback`
   - Redirect URLs: `miga://auth/callback`, `miga://**`, `exp://**`
   - For email templates, make sure magic-link buttons use `{{ .RedirectTo }}`,
     not only `{{ .SiteURL }}`.
3. **RevenueCat dashboard**: create the `premium` entitlement with monthly/yearly
   products; add a webhook to
   `https://YOUR_REF.supabase.co/functions/v1/revenuecat-webhook` with the
   `REVENUECAT_WEBHOOK_AUTH` value as the Authorization header.

## 3. App setup

```bash
npm install
cp .env.example .env      # fill EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY (+ RevenueCat keys)
npm start                 # Expo dev server → press i / a, or scan with Expo Go
```

For EAS/TestFlight builds, also create the public client variables in the EAS
environment used by the build:

```bash
eas env:create production --name EXPO_PUBLIC_SUPABASE_URL --visibility plaintext
eas env:create production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --visibility plaintext
eas env:create production --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --visibility plaintext
eas env:create production --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --visibility plaintext
```

### Auth in Expo Go

Expo Go uses an `exp://.../--/auth/callback` redirect instead of the app scheme
(`miga://auth/callback`). If a magic link or Google OAuth sends the phone to
`localhost`/`127.0.0.1`, restart Expo with a reachable URL:

```bash
npx expo start --tunnel -c
```

Then retry login and check the Metro log line `[auth] redirect URL:`. That exact
URL must match the Supabase allowlist (`exp://**` covers local development).
For the most stable auth flow, use a development build, where the redirect is
`miga://auth/callback`.

Quality gates:

```bash
npm run typecheck   # strict TS
npm test            # jest: nutrition math, unit normalization, AI schema guards
npm run lint
```

## 4. What works where

| Feature | Expo Go | Dev build |
|---|---|---|
| Auth, i18n, Today, pantry, recipes, planning | ✅ | ✅ |
| Camera + barcode scanning, AI photo/receipt flows | ✅ | ✅ |
| RevenueCat purchases | ❌ (free tier behavior) | ✅ |
| HealthKit / Health Connect | ❌ (no-op) | ✅ after [activation](docs/health-integrations.md) |

## 5. EAS builds

```bash
npm i -g eas-cli && eas login
eas init                                  # writes projectId into app config
eas build --profile development --platform ios     # dev client (purchases, health)
eas build --profile preview --platform all         # internal distribution
eas build --profile production --platform all      # store submission
eas submit --platform ios
```

Profiles live in `eas.json` (development / preview / production, remote versioning).

## 6. Project layout

```
src/app/          Expo Router: (auth), onboarding, (tabs)/{today,scan,inventory,recipes,planning}, profile, ai
src/components/ui UI kit (Glass, ProgressRing, MacroBar, states…)
src/features/     per-domain services + hooks (auth, scan, today, recipes, planning, premium, ai…)
src/lib/          supabase, query, i18n (+locales), ai client, revenuecat, health
src/stores/       zustand: offline queue, settings, onboarding draft
src/theme/        design tokens (HIG type scale, light/dark palettes)
src/types/        domain model + zod schemas for AI responses
src/utils/        nutrition math, units, dates (+ tests)
supabase/         migrations (schema/RLS/RPCs), seed.sql, functions/ (Edge + _shared/ai)
docs/             architecture, privacy, ai-safety, compliance, health
```

## 7. Conventions
- Every visible string comes from `src/lib/i18n/locales/{en,es}.json`.
- No client writes to critical tables — SECURITY DEFINER RPCs only (see RLS doc
  header in `supabase/migrations/00002_rls.sql`).
- AI responses must parse against the zod schemas on both server and client.
- Images from scans are deleted right after processing — keep it that way.

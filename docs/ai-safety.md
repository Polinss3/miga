# Miga — AI Safety

## Design stance
AI powers **closed flows** (analyze plate / receipt / label, create & improve
recipes, generate plans, deterministic shopping lists) plus one bounded advisor
chat. The model never writes to the database: every AI output is a **draft** that
the user reviews and confirms, and the write then happens through a validated RPC.

## Layered controls

1. **Server-side only** — models are called exclusively from Edge Functions.
   No API keys or prompts ship in the app binary.
2. **Entitlement + quota before every call** — `authorizeAiRequest()` checks
   premium (`subscriptions` via `is_premium()`) or decrements the free monthly
   quota (`consume_ai_quota_if_needed()`, default 10). Refusals return
   `quota_exceeded` and nothing is billed.
3. **Structured output, double-validated** — every function demands a JSON object,
   validates with zod on the server (`_shared/schemas.ts`) and the client
   re-validates (`src/types/ai.ts`). Bounds reject hallucinated values
   (e.g. `estimated_grams ≤ 3000`, `kcal ≤ 5000`, plan dates outside the requested
   window are dropped).
4. **Safety system rules** (`SAFETY_RULES` in `_shared/context.ts`, injected into
   every prompt):
   - General nutrition information only — never diagnosis, prescription or
     medication/supplement advice for medical conditions.
   - Never suggest <1200 kcal/day, extreme fasting, purging or rapid-loss tactics.
   - Eating disorders, pregnancy, minors, diabetes or medical conditions ⇒
     recommend a doctor or registered dietitian.
   - Allergens from the user's allergy list must never appear in any suggestion
     (enforced again by the user reviewing drafts before saving).
   - Refuse unsafe/out-of-scope requests briefly and redirect.
5. **Audit trail** — `ai_requests` records kind/status/error per call;
   `ai_results` stores only validated JSON (never images). Users can read their
   own audit rows; only the service role writes them.
6. **Deterministic where possible** — shopping lists, inventory deduction and
   nutrition math are SQL/TypeScript, not AI, so core numbers are reproducible.

## Client-side calorie math is also guarded
Targets from onboarding use Mifflin-St Jeor with a hard floor (1200/1500 kcal) and
capped water targets — see `src/utils/nutrition.ts` and its tests.

## Escalation copy
The chat UI persistently shows the localized disclaimer
(`ai.disclaimer`): general guidance, not medical advice. The model additionally
sets `refused_medical: true` when it declines, which is audited.

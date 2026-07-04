import { getAiProvider, extractJson } from '../_shared/ai/index.ts';
import { buildUserContext, SAFETY_RULES } from '../_shared/context.ts';
import { authorizeAiRequest, recordAiFailure, recordAiResult } from '../_shared/guard.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';
import { mealPlanDraftSchema } from '../_shared/schemas.ts';

const SYSTEM_PROMPT = `You are a meal planner for the Miga app.
Create a realistic meal plan matching the user's daily targets, preferences, pantry, skill, time and budget.

Return ONLY a JSON object:
{
  "meals": [
    {
      "date": "YYYY-MM-DD",
      "meal_type": "breakfast" | "lunch" | "dinner" | "snack" | "flexible",
      "title": string,                 // short dish name
      "description": string | null,    // 1-2 sentences: what it is / how to make it quickly
      "recipe_id": string | null,      // ONLY a real id from the user's recipe list, else null
      "uses_inventory": string[],      // pantry item names this meal consumes
      "nutrients": { "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number }
    }
  ],
  "daily_kcal_estimate": number,
  "notes": string[]
}

Rules:
- CRITICAL: return meals for EVERY single date you are given — never fewer days. If you
  receive 7 dates and the user eats 3 meals/day, return ~21 meal entries (one per meal per day).
  Do not summarize, do not return just one representative day.
- Cover each date with the user's meals_per_day structure (breakfast/lunch/dinner + snacks as
  needed); use "flexible" only for flexible planning style. Vary dishes across the days.
- Daily totals should land within ±10% of the calorie target and close to the protein target.
- Prefer pantry items close to expiry; prefer the user's own recipes when they fit (use their exact recipe_id).
- Respect restrictions and NEVER include allergens.
- Keep prep time within the user's available cooking time; match budget level.
${SAFETY_RULES}`;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const auth = await authorizeAiRequest(req, 'meal_plan');
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const startDate = typeof body?.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.start_date)
    ? body.start_date
    : null;
  const days = Number.isInteger(body?.days) && body.days >= 1 && body.days <= 7 ? body.days : null;
  if (!startDate || !days) return errorResponse('invalid_request');

  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${startDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  try {
    const userContext = await buildUserContext(auth.service, auth.user.id, {
      inventory: true,
      recipes: true,
    });
    const provider = getAiProvider();
    const raw = await provider.generate({
      system: SYSTEM_PROMPT,
      json: true,
      temperature: 0.5,
      // A full week needs room and a little reasoning, or a nano model returns
      // only the first day. 'low' balances completeness with latency.
      maxTokens: days > 1 ? 14000 : 4000,
      reasoningEffort: days > 1 ? 'low' : 'minimal',
      messages: [
        {
          role: 'user',
          parts: [
            {
              type: 'text',
              text:
                `${userContext}\n\nGenerate a meal plan covering ALL of these ${dates.length} dates: ${dates.join(', ')}.\n` +
                `Return a meal entry for every one of these ${dates.length} dates (do not stop after the first day).`,
            },
          ],
        },
      ],
    });

    const parsed = mealPlanDraftSchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      await recordAiFailure(auth, 'invalid_response');
      return errorResponse('invalid_response');
    }

    // Drop meals outside the requested window (hallucination guard).
    const valid = {
      ...parsed.data,
      meals: parsed.data.meals.filter((meal) => dates.includes(meal.date)),
    };
    if (valid.meals.length === 0) {
      await recordAiFailure(auth, 'invalid_response');
      return errorResponse('invalid_response');
    }

    // Draft only — persisted by accept_meal_plan after user confirmation.
    await recordAiResult(auth, { days, meals: valid.meals.length });
    return jsonResponse(valid);
  } catch (error) {
    await recordAiFailure(auth, 'provider_error');
    return errorResponse('provider_error', error instanceof Error ? error.message : 'unknown');
  }
});

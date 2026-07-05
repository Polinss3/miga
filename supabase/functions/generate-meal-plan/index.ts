import { extractJson, getAiProvider } from '../_shared/ai/index.ts';
import { buildUserContext, SAFETY_RULES } from '../_shared/context.ts';
import { authorizeAiRequest, recordAiFailure, recordAiResult } from '../_shared/guard.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';
import { dayPlanSchema } from '../_shared/schemas.ts';

const SYSTEM_PROMPT = `You are a meal planner for the Miga app.
Plan ONE day of meals that HITS the user's calorie and protein targets and respects their
profile, pantry, saved recipes, cooking skill, time and budget.

Return ONLY a JSON object:
{
  "meals": [
    {
      "date": "YYYY-MM-DD",
      "meal_type": "breakfast" | "lunch" | "dinner" | "snack" | "flexible",
      "title": string,                 // short dish name
      "description": string | null,    // 1-2 sentences: what it is / how to make it quickly
      "recipe_id": string | null,      // a real id from the user's recipe list when you use one, else null
      "uses_inventory": string[],      // pantry item names this meal consumes
      "nutrients": { "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number }
    }
  ]
}

Rules (in priority order):
1. CALORIES: the SUM of every meal's kcal for the day MUST land within ±8% of the day's calorie
   target. This is the most important rule — distribute the target across the day's meals so the
   total actually reaches it (do NOT under-shoot). Protein total should be close to its target too.
2. Return the user's meals-per-day structure for the date (breakfast/lunch/dinner + snacks as
   needed); use "flexible" only for the flexible planning style.
3. RECIPES: strongly prefer the user's OWN saved recipes when they fit a slot — set recipe_id to
   their EXACT id and reuse that recipe's name and per-serving nutrients (scale if needed).
4. Prefer pantry items close to expiry. Respect restrictions and NEVER include allergens.
5. Keep prep time within the user's available cooking time; match budget level.
6. Do NOT repeat dishes already used earlier in the week (a list is provided).
${SAFETY_RULES}`;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const auth = await authorizeAiRequest(req, 'meal_plan');
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const startDate =
    typeof body?.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.start_date) ? body.start_date : null;
  const days = Number.isInteger(body?.days) && body.days >= 1 && body.days <= 7 ? body.days : null;
  if (!startDate || !days) return errorResponse('invalid_request');

  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${startDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  try {
    const [{ data: goals }, userContext] = await Promise.all([
      auth.service.from('user_goals').select('kcal, protein_g').eq('user_id', auth.user.id).maybeSingle(),
      buildUserContext(auth.service, auth.user.id, { inventory: true, recipes: true }),
    ]);
    const kcalTarget = goals?.kcal ?? 2000;
    const proteinTarget = goals?.protein_g ?? 110;

    const provider = getAiProvider();

    // Generate day by day: each call is a small, focused task (reliable on a
    // nano model) that must hit the daily target, and we pass the dishes
    // already chosen so the week stays varied.
    const allMeals: unknown[] = [];
    const usedTitles: string[] = [];

    for (const date of dates) {
      try {
        const raw = await provider.generate({
          system: SYSTEM_PROMPT,
          json: true,
          temperature: 0.5,
          maxTokens: 3000,
          reasoningEffort: 'minimal',
          messages: [
            {
              role: 'user',
              parts: [
                {
                  type: 'text',
                  text:
                    `${userContext}\n\nPlan all meals for ${date}.\n` +
                    `THIS DAY must total ${kcalTarget} kcal (the sum of every meal's kcal within ±8% of ${kcalTarget}) ` +
                    `and about ${proteinTarget} g protein.\n` +
                    `Dishes already used this week (do not repeat): ${usedTitles.join(', ') || 'none'}.`,
                },
              ],
            },
          ],
        });

        const parsed = dayPlanSchema.safeParse(extractJson(raw));
        if (!parsed.success) continue;

        // Force the requested date (models occasionally echo the wrong day).
        const meals = parsed.data.meals.map((meal) => ({ ...meal, date }));
        allMeals.push(...meals);
        usedTitles.push(...meals.map((meal) => meal.title));
      } catch {
        // Skip a day that failed rather than losing the whole plan.
        continue;
      }
    }

    if (allMeals.length === 0) {
      await recordAiFailure(auth, 'invalid_response');
      return errorResponse('invalid_response');
    }

    const totalKcal = allMeals.reduce(
      (sum, meal) => sum + ((meal as { nutrients?: { kcal?: number } }).nutrients?.kcal ?? 0),
      0,
    );
    const result = {
      meals: allMeals,
      daily_kcal_estimate: Math.round(totalKcal / dates.length),
      notes: [] as string[],
    };

    await recordAiResult(auth, { days, meals: allMeals.length });
    return jsonResponse(result);
  } catch (error) {
    await recordAiFailure(auth, 'provider_error');
    return errorResponse('provider_error', error instanceof Error ? error.message : 'unknown');
  }
});

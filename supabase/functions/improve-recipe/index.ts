import { getAiProvider, extractJson } from '../_shared/ai/index.ts';
import { buildUserContext, SAFETY_RULES } from '../_shared/context.ts';
import { authorizeAiRequest, recordAiFailure, recordAiResult } from '../_shared/guard.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';
import { recipeDraftSchema } from '../_shared/schemas.ts';

const GOALS: Record<string, string> = {
  healthier: 'Make it healthier: more vegetables and fiber, less saturated fat, less sugar and sodium.',
  more_protein: 'Increase protein per serving significantly while keeping it tasty.',
  lower_calories: 'Reduce calories per serving by at least 20% without ruining satiety.',
  cheaper: 'Make it cheaper using affordable, widely available ingredients.',
  use_inventory: "Adapt it to use the user's pantry inventory as much as possible.",
  adapt_restrictions: "Adapt it to fully comply with the user's dietary restrictions and allergies.",
};

const SYSTEM_PROMPT = `You improve recipes for the Miga app.
Return ONLY a JSON object with the improved recipe (same shape as the input recipe):
{
  "name": string, "description": string | null, "servings": number, "time_minutes": number,
  "difficulty": "easy" | "medium" | "hard",
  "ingredients": [{ "name": string, "quantity": number, "unit": "g" | "ml" | "unit" | "serving" }],
  "steps": string[], "tags": string[],
  "nutrients_per_serving": { "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number },
  "change_summary": string   // 1-3 sentences describing what changed and why
}
Keep the spirit of the original recipe. Do not change servings unless necessary.
${SAFETY_RULES}`;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const auth = await authorizeAiRequest(req, 'recipe_improve');
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const goal = typeof body?.goal === 'string' && GOALS[body.goal] ? (body.goal as string) : null;
  const recipeId = typeof body?.recipe_id === 'string' ? body.recipe_id : null;
  if (!goal || !recipeId) return errorResponse('invalid_request');

  // Ownership check via service client (RLS is bypassed here).
  const { data: recipe } = await auth.service
    .from('recipes')
    .select('*, ingredients:recipe_ingredients(name, quantity, unit)')
    .eq('id', recipeId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!recipe) return errorResponse('not_found');

  try {
    const userContext = await buildUserContext(auth.service, auth.user.id, {
      inventory: goal === 'use_inventory',
    });
    const provider = getAiProvider();
    const raw = await provider.generate({
      system: SYSTEM_PROMPT,
      json: true,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          parts: [
            {
              type: 'text',
              text: `${userContext}\n\nGoal: ${GOALS[goal]}\n\nOriginal recipe:\n${JSON.stringify({
                name: recipe.name,
                description: recipe.description,
                servings: recipe.servings,
                time_minutes: recipe.time_minutes,
                difficulty: recipe.difficulty,
                ingredients: recipe.ingredients,
                steps: recipe.steps,
              })}`,
            },
          ],
        },
      ],
    });

    const parsed = recipeDraftSchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      await recordAiFailure(auth, 'invalid_response');
      return errorResponse('invalid_response');
    }

    await recordAiResult(auth, parsed.data);
    return jsonResponse(parsed.data);
  } catch (error) {
    await recordAiFailure(auth, 'provider_error');
    return errorResponse('provider_error', error instanceof Error ? error.message : 'unknown');
  }
});

import { getAiProvider, extractJson, type AiPart } from '../_shared/ai/index.ts';
import { buildUserContext, SAFETY_RULES } from '../_shared/context.ts';
import { authorizeAiRequest, recordAiFailure, recordAiResult, validateImagePayload } from '../_shared/guard.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';
import { recipeDraftSchema } from '../_shared/schemas.ts';

const SYSTEM_PROMPT = `You are a recipe writer for the Miga app.
Given a pasted recipe, a photo of a recipe, or a free-text request, produce ONE structured recipe.

Return ONLY a JSON object:
{
  "name": string,
  "description": string | null,
  "servings": number,
  "time_minutes": number,
  "difficulty": "easy" | "medium" | "hard",
  "ingredients": [{ "name": string, "quantity": number, "unit": "g" | "ml" | "unit" | "serving" }],
  "steps": string[],
  "tags": string[],
  "nutrients_per_serving": { "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g"?: number, "sugar_g"?: number, "sodium_mg"?: number },
  "change_summary": null
}

Rules:
- When structuring pasted/photographed recipes: preserve the original faithfully; only normalize quantities and compute nutrition.
- When generating from a request: respect the user's restrictions, allergies, dislikes, skill, time and budget.
- nutrients_per_serving must be a realistic estimate for one serving.
${SAFETY_RULES}`;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const auth = await authorizeAiRequest(req, 'recipe_create');
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const kind = body?.kind === 'paste' || body?.kind === 'photo' ? body.kind : 'generate';

  const parts: AiPart[] = [];
  if (kind === 'photo') {
    const image = validateImagePayload(body?.image_base64);
    if (!image) return errorResponse('invalid_request', 'image_base64 missing or too large');
    parts.push({ type: 'text', text: 'Structure the recipe in this photo:' });
    parts.push({ type: 'image', base64: image, mediaType: 'image/jpeg' });
  } else {
    const text = typeof body?.text === 'string' ? body.text.slice(0, 8000) : '';
    if (!text.trim()) return errorResponse('invalid_request', 'text missing');
    parts.push({
      type: 'text',
      text:
        kind === 'paste'
          ? `Structure this pasted recipe:\n\n${text}`
          : `Create a recipe for this request:\n\n${text}`,
    });
  }

  try {
    const userContext = await buildUserContext(auth.service, auth.user.id, { inventory: kind === 'generate' });
    const provider = getAiProvider();
    const raw = await provider.generate({
      system: SYSTEM_PROMPT,
      json: true,
      temperature: kind === 'generate' ? 0.6 : 0.2,
      messages: [{ role: 'user', parts: [{ type: 'text', text: userContext }, ...parts] }],
    });

    const parsed = recipeDraftSchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      await recordAiFailure(auth, 'invalid_response');
      return errorResponse('invalid_response');
    }

    // Draft only — the recipe is saved by the client through
    // create_recipe_with_ingredients after explicit user confirmation.
    await recordAiResult(auth, parsed.data);
    return jsonResponse(parsed.data);
  } catch (error) {
    await recordAiFailure(auth, 'provider_error');
    return errorResponse('provider_error', error instanceof Error ? error.message : 'unknown');
  }
});

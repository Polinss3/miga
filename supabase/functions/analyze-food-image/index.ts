import { getAiProvider, extractJson } from '../_shared/ai/index.ts';
import { buildUserContext, SAFETY_RULES } from '../_shared/context.ts';
import { authorizeAiRequest, recordAiFailure, recordAiResult, validateImagePayload } from '../_shared/guard.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';
import { foodPhotoAnalysisSchema } from '../_shared/schemas.ts';

const SYSTEM_PROMPT = `You are a nutrition vision analyst for the Miga app.
Analyze the photo of a meal and estimate its contents.

Return ONLY a JSON object with this exact shape:
{
  "is_food": boolean,            // false if the image is not food
  "overall_confidence": "low" | "medium" | "high",
  "warnings": string[],          // e.g. "sauce not visible, calories may be higher"
  "items": [
    {
      "name": string,            // short food name in the user's language
      "estimated_grams": number, // realistic portion estimate
      "confidence": "low" | "medium" | "high",
      "nutrients": { "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g"?: number, "sugar_g"?: number, "sodium_mg"?: number, "caffeine_mg"?: number }
    }
  ]
}

Rules:
- nutrients are for the estimated portion (not per 100 g).
- Be conservative: prefer "medium"/"low" confidence over false precision.
- Maximum 15 items. If not food, return is_food=false and an empty items array.
${SAFETY_RULES}`;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const auth = await authorizeAiRequest(req, 'food_photo');
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const image = validateImagePayload(body?.image_base64);
  if (!image) return errorResponse('invalid_request', 'image_base64 missing or too large');
  const mode = body?.mode === 'precise' ? 'precise' : 'fast';

  try {
    const userContext = await buildUserContext(auth.service, auth.user.id);
    const provider = getAiProvider();
    const raw = await provider.generate({
      system: SYSTEM_PROMPT,
      json: true,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          parts: [
            {
              type: 'text',
              text: `${userContext}\n\nMode: ${mode === 'precise' ? 'precise — user will confirm grams per item, list each component separately' : 'fast — quick reasonable estimate'}. Analyze this meal photo:`,
            },
            { type: 'image', base64: image, mediaType: 'image/jpeg' },
          ],
        },
      ],
    });

    const parsed = foodPhotoAnalysisSchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      await recordAiFailure(auth, 'invalid_response');
      return errorResponse('invalid_response');
    }

    // Only the structured result is stored — the image is never persisted.
    await recordAiResult(auth, parsed.data);
    return jsonResponse(parsed.data);
  } catch (error) {
    await recordAiFailure(auth, 'provider_error');
    return errorResponse('provider_error', error instanceof Error ? error.message : 'unknown');
  }
});

import { getAiProvider, extractJson } from '../_shared/ai/index.ts';
import { authorizeAiRequest, recordAiFailure, recordAiResult, validateImagePayload } from '../_shared/guard.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';
import { nutritionLabelSchema } from '../_shared/schemas.ts';

const SYSTEM_PROMPT = `You read nutrition facts labels (any language, typically EU format).
Return ONLY a JSON object:
{
  "product_name": string | null,
  "serving_size_g": number | null,
  "nutrients_per_100": { "kcal"?: number, "protein_g"?: number, "carbs_g"?: number, "fat_g"?: number, "fiber_g"?: number, "sugar_g"?: number, "sodium_mg"?: number, "caffeine_mg"?: number },
  "warnings": string[]
}
Rules:
- Values MUST be per 100 g / 100 ml. If the label shows per-serving values, convert them.
- kJ is not kcal: if only kJ is present, convert (1 kcal = 4.184 kJ).
- Salt vs sodium: sodium_mg = salt_g * 400.
- Omit fields you cannot read; add a warning instead of guessing.`;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const auth = await authorizeAiRequest(req, 'nutrition_label');
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const image = validateImagePayload(body?.image_base64);
  if (!image) return errorResponse('invalid_request', 'image_base64 missing or too large');

  try {
    const provider = getAiProvider();
    const raw = await provider.generate({
      system: SYSTEM_PROMPT,
      json: true,
      temperature: 0,
      messages: [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Read this nutrition label:' },
            { type: 'image', base64: image, mediaType: 'image/jpeg' },
          ],
        },
      ],
    });

    const parsed = nutritionLabelSchema.safeParse(extractJson(raw));
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

import { getAiProvider, extractJson } from '../_shared/ai/index.ts';
import { SAFETY_RULES } from '../_shared/context.ts';
import { authorizeAiRequest, recordAiFailure, recordAiResult, validateImagePayload } from '../_shared/guard.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';
import { receiptAnalysisSchema } from '../_shared/schemas.ts';

const SYSTEM_PROMPT = `You are a grocery receipt parser for the Miga app.
Extract structured data from the receipt photo (any language, typically Spanish or English).

Return ONLY a JSON object:
{
  "store": string | null,          // store name if visible
  "date": "YYYY-MM-DD" | null,     // purchase date if visible
  "total": number | null,
  "currency": string | null,       // ISO code like "EUR"
  "warnings": string[],
  "items": [
    {
      "raw_text": string,          // the original receipt line
      "name": string,              // cleaned product name, natural casing, same language as receipt
      "brand": string | null,
      "quantity": number,          // in the unit below; expand weights (0.5 kg -> 500 g)
      "unit": "g" | "ml" | "unit" | "serving",
      "price": number | null,      // total line price
      "category": "produce" | "meat" | "dairy" | "grains" | "frozen" | "pantry" | "drinks" | "other",
      "is_food": boolean,          // false for detergent, bags, etc.
      "nutrients_per_100": { "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number } | null
                                   // rough typical values for generic foods; null if unsure
    }
  ]
}

Rules:
- One entry per distinct product line. Multi-quantity lines (x2, x3) become quantity in units.
- Do not invent products that are not on the receipt.
- nutrients_per_100 only for foods you can estimate with reasonable generic values.
${SAFETY_RULES}`;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const auth = await authorizeAiRequest(req, 'receipt');
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const image = validateImagePayload(body?.image_base64);
  if (!image) return errorResponse('invalid_request', 'image_base64 missing or too large');

  try {
    const provider = getAiProvider();
    const raw = await provider.generate({
      system: SYSTEM_PROMPT,
      json: true,
      temperature: 0.1,
      maxTokens: 6000,
      messages: [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Parse this receipt:' },
            { type: 'image', base64: image, mediaType: 'image/jpeg' },
          ],
        },
      ],
    });

    const parsed = receiptAnalysisSchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      await recordAiFailure(auth, 'invalid_response');
      return errorResponse('invalid_response');
    }

    // Privacy: image processed in-memory only; structured data returned for
    // user review. Nothing is written to the DB until the user confirms
    // (confirm_receipt RPC).
    await recordAiResult(auth, { store: parsed.data.store, items: parsed.data.items.length });
    return jsonResponse(parsed.data);
  } catch (error) {
    await recordAiFailure(auth, 'provider_error');
    return errorResponse('provider_error', error instanceof Error ? error.message : 'unknown');
  }
});

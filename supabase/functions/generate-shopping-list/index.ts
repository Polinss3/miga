import { extractJson, getAiProvider } from '../_shared/ai/index.ts';
import { buildUserContext, SAFETY_RULES } from '../_shared/context.ts';
import { authorizeAiRequest, recordAiFailure, recordAiResult } from '../_shared/guard.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';
import { shoppingListDraftSchema } from '../_shared/schemas.ts';

const SYSTEM_PROMPT = `You are a grocery-shopping assistant for the Miga app.
Given a week's planned meals and the user's current pantry, produce ONE consolidated
shopping list of real grocery products a person would actually buy.

Return ONLY a JSON object:
{
  "items": [
    {
      "name": string,                 // a concrete grocery product, e.g. "Pechuga de pollo", "Leche entera", "Arroz basmati"
      "quantity": number | null,      // realistic purchase amount (round to how it's sold)
      "unit": "g" | "ml" | "unit" | "serving" | null,
      "category": "produce" | "meat" | "dairy" | "grains" | "frozen" | "pantry" | "drinks" | "other",
      "note": string | null           // optional, e.g. "para 3 cenas"
    }
  ],
  "notes": string[]
}

Rules:
- Be GENEROUS and COMPLETE: infer every ingredient the planned meals need, even when a meal
  only has a title/description and no attached recipe. Think like a cook shopping for the week.
- Use realistic retail quantities (a dozen eggs = 12 unit; rice ~1000 g; milk ~1000 ml), not per-meal grams.
- Consolidate duplicates across meals into a single line with the summed amount.
- SUBTRACT what the pantry already has: only list what still needs buying. If the pantry fully
  covers something, omit it.
- Group each item into the correct category. Staples (oil, salt, spices) only if clearly needed.
- Write product names in the user's language.
${SAFETY_RULES}`;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const auth = await authorizeAiRequest(req, 'shopping_list');
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const startDate =
    typeof body?.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.start_date) ? body.start_date : null;
  const days = Number.isInteger(body?.days) && body.days >= 1 && body.days <= 14 ? body.days : 7;
  if (!startDate) return errorResponse('invalid_request');

  const endDate = new Date(`${startDate}T12:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + days - 1);
  const endKey = endDate.toISOString().slice(0, 10);

  try {
    // Planned meals in range (any plan the user owns), plus any linked-recipe
    // ingredients to ground the list.
    const { data: items } = await auth.service
      .from('meal_plan_items')
      .select('date, meal_type, title, description, recipe_id, plan:meal_plans!inner(user_id)')
      .eq('plan.user_id', auth.user.id)
      .gte('date', startDate)
      .lte('date', endKey)
      .order('date', { ascending: true });

    if (!items || items.length === 0) return errorResponse('invalid_request', 'no planned meals');

    const recipeIds = [...new Set(items.map((i) => i.recipe_id).filter(Boolean))] as string[];
    let recipeLines = '';
    if (recipeIds.length > 0) {
      const { data: ings } = await auth.service
        .from('recipe_ingredients')
        .select('name, quantity, unit, recipe:recipes!inner(name)')
        .in('recipe_id', recipeIds);
      if (ings?.length) {
        recipeLines =
          '\nLinked recipe ingredients: ' +
          ings.map((i) => `${i.name} ${i.quantity}${i.unit}`).join('; ');
      }
    }

    const menu = items
      .map((i) => `${i.date} ${i.meal_type}: ${i.title}${i.description ? ` — ${i.description}` : ''}`)
      .join('\n');

    const userContext = await buildUserContext(auth.service, auth.user.id, { inventory: true });
    const provider = getAiProvider();
    const raw = await provider.generate({
      system: SYSTEM_PROMPT,
      json: true,
      temperature: 0.3,
      maxTokens: 4000,
      messages: [
        {
          role: 'user',
          parts: [
            {
              type: 'text',
              text: `${userContext}\n\nPlanned meals (${startDate} to ${endKey}):\n${menu}${recipeLines}\n\nBuild the consolidated shopping list.`,
            },
          ],
        },
      ],
    });

    const parsed = shoppingListDraftSchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      await recordAiFailure(auth, 'invalid_response');
      return errorResponse('invalid_response');
    }

    await recordAiResult(auth, { items: parsed.data.items.length });
    return jsonResponse(parsed.data);
  } catch (error) {
    await recordAiFailure(auth, 'provider_error');
    return errorResponse('provider_error', error instanceof Error ? error.message : 'unknown');
  }
});

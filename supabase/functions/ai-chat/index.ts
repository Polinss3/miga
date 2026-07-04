import { getAiProvider, extractJson, type AiMessage } from '../_shared/ai/index.ts';
import { buildUserContext, SAFETY_RULES } from '../_shared/context.ts';
import { authorizeAiRequest, recordAiFailure, recordAiResult } from '../_shared/guard.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';
import { chatReplySchema } from '../_shared/schemas.ts';

const SYSTEM_PROMPT = `You are the Miga nutrition advisor: friendly, practical, concise.
You help with everyday eating: what to cook, how the user is tracking against targets,
ideas with pantry items, shopping suggestions, food swaps.

Return ONLY a JSON object:
{
  "reply": string,                  // your answer, plain text, max ~200 words
  "refused_medical": boolean,       // true if you declined medical territory
  "suggested_actions": [            // 0-3 in-app follow-ups, only when clearly useful
    { "type": "create_recipe" | "generate_plan" | "log_meal" | "open_shopping_list", "label": string }
  ]
}

Style:
- Answer in the user's language. Be specific and actionable, not generic.
- Use the provided context (targets, today's intake, pantry) instead of asking for data you already have.
${SAFETY_RULES}`;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const auth = await authorizeAiRequest(req, 'chat');
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 2000) : '';
  if (!message) return errorResponse('invalid_request');

  const history: AiMessage[] = Array.isArray(body?.history)
    ? body.history.slice(-10).flatMap((entry: { role?: string; text?: string }) => {
        if ((entry.role !== 'user' && entry.role !== 'assistant') || typeof entry.text !== 'string') return [];
        return [{ role: entry.role, parts: [{ type: 'text' as const, text: entry.text.slice(0, 2000) }] }];
      })
    : [];

  try {
    // Last-7-days intake summary gives the advisor real grounding for both
    // "today" and "this week" questions.
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: weekMeals } = await auth.service
      .from('meal_items')
      .select('nutrients, meal:meals!inner(user_id, date)')
      .eq('meal.user_id', auth.user.id)
      .gte('meal.date', weekAgo)
      .lte('meal.date', today);

    const byDay = new Map<string, { kcal: number; protein: number }>();
    for (const item of weekMeals ?? []) {
      const date = (item.meal as unknown as { date: string }).date;
      const n = item.nutrients as { kcal?: number; protein_g?: number } | null;
      const day = byDay.get(date) ?? { kcal: 0, protein: 0 };
      day.kcal += n?.kcal ?? 0;
      day.protein += n?.protein_g ?? 0;
      byDay.set(date, day);
    }
    const totals = byDay.get(today) ?? { kcal: 0, protein: 0 };
    const weekLines = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day]) => `${date}: ${Math.round(day.kcal)} kcal, ${Math.round(day.protein)} g protein`)
      .join('; ');

    const userContext = await buildUserContext(auth.service, auth.user.id, {
      inventory: true,
      recipes: true,
    });
    const provider = getAiProvider();
    const raw = await provider.generate({
      system: SYSTEM_PROMPT,
      json: true,
      temperature: 0.6,
      messages: [
        {
          role: 'user',
          parts: [
            {
              type: 'text',
              text:
                `${userContext}\nToday so far: ${Math.round(totals.kcal)} kcal, ${Math.round(totals.protein)} g protein.` +
                (weekLines ? `\nLast 7 days intake: ${weekLines}.` : '\nNo meals logged in the last 7 days.'),
            },
          ],
        },
        ...history,
        { role: 'user', parts: [{ type: 'text', text: message }] },
      ],
    });

    const parsed = chatReplySchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      await recordAiFailure(auth, 'invalid_response');
      return errorResponse('invalid_response');
    }

    await recordAiResult(auth, { refused_medical: parsed.data.refused_medical });
    return jsonResponse(parsed.data);
  } catch (error) {
    await recordAiFailure(auth, 'provider_error');
    return errorResponse('provider_error', error instanceof Error ? error.message : 'unknown');
  }
});

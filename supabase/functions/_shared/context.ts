import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Builds the personalization block injected into AI prompts:
 * goals, targets, restrictions, allergies, dislikes, pantry and recipes.
 * Only aggregated/necessary data — never emails, tokens or free-form notes.
 */
export async function buildUserContext(
  service: SupabaseClient,
  userId: string,
  options: { inventory?: boolean; recipes?: boolean } = {},
): Promise<string> {
  const [profileRes, goalsRes, dietRes, allergiesRes] = await Promise.all([
    service
      .from('profiles')
      .select(
        'language, age, sex, height_cm, weight_kg, target_weight_kg, activity_level, goal, planning_style, cooking_skill, cooking_time_minutes, budget_level, meals_per_day',
      )
      .eq('id', userId)
      .maybeSingle(),
    service.from('user_goals').select('kcal, protein_g, carbs_g, fat_g').eq('user_id', userId).maybeSingle(),
    service.from('dietary_preferences').select('restrictions, dislikes').eq('user_id', userId).maybeSingle(),
    service.from('allergies').select('name').eq('user_id', userId),
  ]);

  const profile = profileRes.data;
  const goals = goalsRes.data;
  const diet = dietRes.data;
  const allergies = (allergiesRes.data ?? []).map((a) => a.name);

  const lines: string[] = [];
  if (profile) {
    lines.push(
      `User profile: goal=${profile.goal}, activity=${profile.activity_level}, ` +
        `sex=${profile.sex}, age=${profile.age ?? 'unknown'}, weight=${profile.weight_kg ?? '?'}kg, ` +
        `cooking_skill=${profile.cooking_skill}, time_per_meal=${profile.cooking_time_minutes}min, ` +
        `budget=${profile.budget_level}, meals_per_day=${profile.meals_per_day}, ` +
        `planning_style=${profile.planning_style}, language=${profile.language}`,
    );
  }
  if (goals) {
    lines.push(
      `Daily targets: ${goals.kcal} kcal, ${goals.protein_g} g protein, ${goals.carbs_g} g carbs, ${goals.fat_g} g fat`,
    );
  }
  if (diet?.restrictions?.length) lines.push(`Dietary restrictions (MUST respect): ${diet.restrictions.join(', ')}`);
  if (allergies.length) lines.push(`Allergies (MUST NEVER appear in any suggestion): ${allergies.join(', ')}`);
  if (diet?.dislikes?.length) lines.push(`Dislikes (avoid): ${diet.dislikes.join(', ')}`);

  if (options.inventory) {
    const { data: items } = await service
      .from('inventory_items')
      .select('name, quantity, unit, expiry_date')
      .eq('user_id', userId)
      .gt('quantity', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .limit(60);
    if (items?.length) {
      lines.push(
        'Pantry inventory: ' +
          items
            .map((i) => `${i.name} (${i.quantity} ${i.unit}${i.expiry_date ? `, expires ${i.expiry_date}` : ''})`)
            .join('; '),
      );
    }
  }

  if (options.recipes) {
    const { data: recipes } = await service
      .from('recipes')
      .select('id, name, time_minutes, nutrients_per_serving')
      .eq('user_id', userId)
      .limit(40);
    if (recipes?.length) {
      lines.push(
        'User recipes (prefer these; reference by recipe_id): ' +
          recipes
            .map(
              (r) =>
                `[id=${r.id}] ${r.name} (${r.time_minutes ?? '?'}min, ${
                  (r.nutrients_per_serving as { kcal?: number } | null)?.kcal ?? '?'
                } kcal/serving)`,
            )
            .join('; '),
      );
    }
  }

  const { data: profileLang } = profileRes;
  lines.push(
    `Write all user-visible text in ${profileLang?.language === 'es' ? 'Spanish' : 'English'}.`,
  );

  return lines.join('\n');
}

/** Shared safety rules appended to every prompt (see docs/ai-safety.md). */
export const SAFETY_RULES = `
Safety rules (non-negotiable):
- You provide general nutrition information, not medical advice. Never diagnose, never prescribe, never recommend medication or supplements for medical conditions.
- Never suggest diets below 1200 kcal/day, extreme fasting, purging, or rapid-weight-loss techniques.
- If the user mentions an eating disorder, pregnancy, minors, diabetes or any medical condition, include a short recommendation to consult a doctor or registered dietitian.
- Never include an allergen listed in the user's allergies in any suggestion.
- If asked for something unsafe or out of scope, refuse briefly and redirect to safe alternatives.`;

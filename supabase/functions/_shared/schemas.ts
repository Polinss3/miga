import { z } from 'zod';

/**
 * Server-side validation of AI structured outputs.
 * Mirror of src/types/ai.ts (client) — keep both in sync.
 * A response that fails these schemas is never returned to the app
 * and never written to the database.
 */

export const nutrientsSchema = z.object({
  kcal: z.number().min(0).max(5000),
  protein_g: z.number().min(0).max(500),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(500),
  fiber_g: z.number().min(0).max(200).optional(),
  sugar_g: z.number().min(0).max(500).optional(),
  sodium_mg: z.number().min(0).max(50000).optional(),
  caffeine_mg: z.number().min(0).max(2000).optional(),
});

export const foodPhotoAnalysisSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        estimated_grams: z.number().min(1).max(3000),
        nutrients: nutrientsSchema,
        confidence: z.enum(['low', 'medium', 'high']),
      }),
    )
    .max(15),
  overall_confidence: z.enum(['low', 'medium', 'high']),
  warnings: z.array(z.string()).default([]),
  is_food: z.boolean(),
});

export const receiptAnalysisSchema = z.object({
  store: z.string().max(120).nullish(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  total: z.number().min(0).nullish(),
  currency: z.string().max(3).nullish(),
  items: z
    .array(
      z.object({
        raw_text: z.string().max(200),
        name: z.string().min(1).max(120),
        brand: z.string().max(80).nullish(),
        quantity: z.number().min(0).max(1000),
        unit: z.enum(['g', 'ml', 'unit', 'serving']),
        price: z.number().min(0).max(10000).nullish(),
        category: z.enum(['produce', 'meat', 'dairy', 'grains', 'frozen', 'pantry', 'drinks', 'other']),
        is_food: z.boolean(),
        nutrients_per_100: nutrientsSchema.partial().nullish(),
      }),
    )
    .max(80),
  warnings: z.array(z.string()).default([]),
});

export const nutritionLabelSchema = z.object({
  product_name: z.string().max(120).nullish(),
  serving_size_g: z.number().min(0).max(2000).nullish(),
  nutrients_per_100: nutrientsSchema.partial(),
  warnings: z.array(z.string()).default([]),
});

export const recipeDraftSchema = z.object({
  name: z.string().min(1).max(140),
  description: z.string().max(600).nullish(),
  servings: z.number().int().min(1).max(24),
  time_minutes: z.number().int().min(1).max(600),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        quantity: z.number().min(0).max(5000),
        unit: z.enum(['g', 'ml', 'unit', 'serving']),
      }),
    )
    .min(1)
    .max(40),
  steps: z.array(z.string().max(600)).min(1).max(30),
  tags: z.array(z.string().max(40)).max(10).default([]),
  nutrients_per_serving: nutrientsSchema,
  change_summary: z.string().max(600).nullish(),
});

export const planMealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'flexible']),
  title: z.string().min(1).max(140),
  description: z.string().max(400).nullish(),
  recipe_id: z.string().uuid().nullish(),
  uses_inventory: z.array(z.string().max(120)).default([]),
  nutrients: nutrientsSchema,
});

/** One day's worth of meals — the meal plan is generated day by day. */
export const dayPlanSchema = z.object({
  meals: z.array(planMealSchema).min(1).max(8),
});

export const mealPlanDraftSchema = z.object({
  meals: z.array(planMealSchema).min(1).max(60),
  daily_kcal_estimate: z.number().min(0).max(8000),
  notes: z.array(z.string().max(300)).default([]),
});

export const shoppingListDraftSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        quantity: z.number().min(0).max(100000).nullish(),
        unit: z.enum(['g', 'ml', 'unit', 'serving']).nullish(),
        category: z.enum(['produce', 'meat', 'dairy', 'grains', 'frozen', 'pantry', 'drinks', 'other']),
        note: z.string().max(120).nullish(),
      }),
    )
    .min(1)
    .max(80),
  notes: z.array(z.string().max(300)).default([]),
});

export const chatReplySchema = z.object({
  reply: z.string().min(1).max(4000),
  refused_medical: z.boolean().default(false),
  suggested_actions: z
    .array(
      z.object({
        type: z.enum(['create_recipe', 'generate_plan', 'log_meal', 'open_shopping_list']),
        label: z.string().max(80),
      }),
    )
    .max(3)
    .default([]),
});

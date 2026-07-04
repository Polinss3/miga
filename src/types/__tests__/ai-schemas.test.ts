import { foodPhotoAnalysisSchema, receiptAnalysisSchema } from '../ai';

describe('foodPhotoAnalysisSchema', () => {
  it('accepts a valid analysis', () => {
    const result = foodPhotoAnalysisSchema.safeParse({
      is_food: true,
      overall_confidence: 'medium',
      warnings: [],
      items: [
        {
          name: 'Grilled chicken breast',
          estimated_grams: 150,
          confidence: 'high',
          nutrients: { kcal: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects absurd values (hallucination guard)', () => {
    const result = foodPhotoAnalysisSchema.safeParse({
      is_food: true,
      overall_confidence: 'high',
      items: [
        {
          name: 'Rice',
          estimated_grams: 999999,
          confidence: 'high',
          nutrients: { kcal: 100, protein_g: 2, carbs_g: 22, fat_g: 0.5 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative nutrients', () => {
    const result = foodPhotoAnalysisSchema.safeParse({
      is_food: true,
      overall_confidence: 'low',
      items: [
        {
          name: 'Mystery',
          estimated_grams: 100,
          confidence: 'low',
          nutrients: { kcal: -50, protein_g: 0, carbs_g: 0, fat_g: 0 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('receiptAnalysisSchema', () => {
  it('accepts a valid receipt', () => {
    const result = receiptAnalysisSchema.safeParse({
      store: 'Mercadona',
      date: '2026-07-01',
      total: 42.35,
      currency: 'EUR',
      items: [
        {
          raw_text: 'PECHUGA POLLO 0,5kg',
          name: 'Pechuga de pollo',
          quantity: 500,
          unit: 'g',
          price: 3.95,
          category: 'meat',
          is_food: true,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects malformed dates', () => {
    const result = receiptAnalysisSchema.safeParse({
      date: '01/07/2026',
      items: [],
    });
    expect(result.success).toBe(false);
  });
});

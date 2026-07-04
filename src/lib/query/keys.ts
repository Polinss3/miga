/**
 * Central query-key factory. Every React Query cache entry is created from
 * here so invalidations stay consistent across features.
 */
export const queryKeys = {
  profile: ['profile'] as const,
  targets: ['targets'] as const,
  dailyLog: (date: string) => ['dailyLog', date] as const,
  meals: (date: string) => ['meals', date] as const,
  inventory: ['inventory'] as const,
  inventoryExpiring: ['inventory', 'expiring'] as const,
  recipes: ['recipes'] as const,
  recipe: (id: string) => ['recipes', id] as const,
  plan: (startDate: string) => ['plan', startDate] as const,
  shoppingList: ['shoppingList'] as const,
  barcodeProduct: (code: string) => ['barcode', code] as const,
  foodSearch: (query: string) => ['foods', 'search', query] as const,
  subscription: ['subscription'] as const,
  aiQuota: ['aiQuota'] as const,
  weightLog: ['weightLog'] as const,
};

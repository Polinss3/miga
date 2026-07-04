import type { FoodUnit } from '@/types/domain';

/**
 * Unit normalization for foods coming from receipts, barcodes and free text.
 * The canonical units are: g, ml, unit, serving.
 */

const UNIT_ALIASES: Record<string, { unit: FoodUnit; factor: number }> = {
  g: { unit: 'g', factor: 1 },
  gr: { unit: 'g', factor: 1 },
  gram: { unit: 'g', factor: 1 },
  grams: { unit: 'g', factor: 1 },
  gramo: { unit: 'g', factor: 1 },
  gramos: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  kilo: { unit: 'g', factor: 1000 },
  kilos: { unit: 'g', factor: 1000 },
  mg: { unit: 'g', factor: 0.001 },
  ml: { unit: 'ml', factor: 1 },
  cl: { unit: 'ml', factor: 10 },
  l: { unit: 'ml', factor: 1000 },
  litro: { unit: 'ml', factor: 1000 },
  litros: { unit: 'ml', factor: 1000 },
  liter: { unit: 'ml', factor: 1000 },
  ud: { unit: 'unit', factor: 1 },
  uds: { unit: 'unit', factor: 1 },
  unidad: { unit: 'unit', factor: 1 },
  unidades: { unit: 'unit', factor: 1 },
  unit: { unit: 'unit', factor: 1 },
  units: { unit: 'unit', factor: 1 },
  pcs: { unit: 'unit', factor: 1 },
  racion: { unit: 'serving', factor: 1 },
  raciones: { unit: 'serving', factor: 1 },
  serving: { unit: 'serving', factor: 1 },
  servings: { unit: 'serving', factor: 1 },
};

export interface NormalizedQuantity {
  quantity: number;
  unit: FoodUnit;
}

/** Normalize "2 kg" → { quantity: 2000, unit: 'g' }. Unknown units become 'unit'. */
export function normalizeQuantity(quantity: number, rawUnit: string): NormalizedQuantity {
  const key = rawUnit.trim().toLowerCase().replace(/\.$/, '');
  const alias = UNIT_ALIASES[key];
  if (!alias) return { quantity, unit: 'unit' };
  return { quantity: quantity * alias.factor, unit: alias.unit };
}

/** Human-readable quantity: prefers kg/L for large amounts. */
export function formatQuantity(quantity: number, unit: FoodUnit): string {
  if (unit === 'g' && quantity >= 1000) return `${trimZeros(quantity / 1000)} kg`;
  if (unit === 'ml' && quantity >= 1000) return `${trimZeros(quantity / 1000)} L`;
  return `${trimZeros(quantity)} ${unit === 'unit' ? 'ud' : unit}`;
}

function trimZeros(n: number): string {
  return Number(n.toFixed(2)).toString();
}

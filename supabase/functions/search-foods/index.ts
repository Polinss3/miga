import { getUser, serviceClient } from '../_shared/db.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';

/**
 * Ingredient search for the recipe builder (MyFitnessPal-style): merges our
 * own catalog (foods + cached barcode_products) with a live Open Food Facts
 * search, so the user can find almost any real product. OFF hits are
 * normalized and cached into barcode_products, so repeat searches are instant
 * and the products also become barcode-scannable. Free tier — no AI, no quota.
 */

interface OffSearchProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  quantity?: string;
  nutriments?: Record<string, number | string>;
}

interface FoodResult {
  key: string;
  name: string;
  brand: string | null;
  unit: 'g' | 'ml' | 'unit' | 'serving';
  nutrients_per_100: Record<string, number>;
  kind: 'catalog' | 'product';
}

function toNumber(value: number | string | undefined): number | undefined {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? (n as number) : undefined;
}

function normalizeNutriments(nutriments: Record<string, number | string>): Record<string, number> {
  const kcal =
    toNumber(nutriments['energy-kcal_100g']) ??
    (toNumber(nutriments['energy_100g']) != null ? toNumber(nutriments['energy_100g'])! / 4.184 : undefined);
  return {
    ...(kcal != null ? { kcal: Math.round(kcal) } : {}),
    ...(toNumber(nutriments['proteins_100g']) != null ? { protein_g: toNumber(nutriments['proteins_100g'])! } : {}),
    ...(toNumber(nutriments['carbohydrates_100g']) != null
      ? { carbs_g: toNumber(nutriments['carbohydrates_100g'])! }
      : {}),
    ...(toNumber(nutriments['fat_100g']) != null ? { fat_g: toNumber(nutriments['fat_100g'])! } : {}),
    ...(toNumber(nutriments['fiber_100g']) != null ? { fiber_g: toNumber(nutriments['fiber_100g'])! } : {}),
    ...(toNumber(nutriments['sugars_100g']) != null ? { sugar_g: toNumber(nutriments['sugars_100g'])! } : {}),
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const user = await getUser(req);
  if (!user) return errorResponse('unauthorized');

  const body = await req.json().catch(() => null);
  const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 80) : '';
  if (query.length < 2) return jsonResponse({ results: [] });

  const service = serviceClient();
  const like = `%${query.replace(/[%,()]/g, ' ')}%`;
  const results: FoodResult[] = [];
  const seen = new Set<string>();

  const add = (r: FoodResult) => {
    const dedupeKey = `${r.name.toLowerCase()}|${r.brand?.toLowerCase() ?? ''}`;
    if (seen.has(dedupeKey) || r.nutrients_per_100.kcal == null) return;
    seen.add(dedupeKey);
    results.push(r);
  };

  // 1. Local catalog first (instant, free).
  const [foodsRes, productsRes] = await Promise.all([
    service.from('foods').select('id, name, name_es, unit, nutrients_per_100').or(`name.ilike.${like},name_es.ilike.${like}`).limit(8),
    service.from('barcode_products').select('barcode, name, brand, unit, nutrients_per_100').or(`name.ilike.${like},brand.ilike.${like}`).limit(8),
  ]);
  for (const f of foodsRes.data ?? []) {
    add({
      key: `food:${f.id}`,
      name: (f.name_es as string) || (f.name as string),
      brand: null,
      unit: (f.unit as FoodResult['unit']) ?? 'g',
      nutrients_per_100: (f.nutrients_per_100 as Record<string, number>) ?? {},
      kind: 'catalog',
    });
  }
  for (const p of productsRes.data ?? []) {
    add({
      key: `product:${p.barcode}`,
      name: p.name as string,
      brand: (p.brand as string) ?? null,
      unit: (p.unit as FoodResult['unit']) ?? 'g',
      nutrients_per_100: (p.nutrients_per_100 as Record<string, number>) ?? {},
      kind: 'product',
    });
  }

  // 2. Open Food Facts search for breadth. Best-effort with a short timeout;
  //    local results already returned if this fails.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1&action=process&json=1&page_size=20&sort_by=unique_scans_n` +
      `&fields=code,product_name,product_name_es,brands,quantity,nutriments`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Miga/1.0 (nutrition app; contact via repo)' },
    }).finally(() => clearTimeout(timeout));

    if (res.ok) {
      const json = await res.json();
      const products = (json?.products ?? []) as OffSearchProduct[];
      const toCache: Record<string, unknown>[] = [];
      for (const p of products) {
        const name = p.product_name_es || p.product_name;
        if (!name || !p.code) continue;
        const nutrients = normalizeNutriments(p.nutriments ?? {});
        if (nutrients.kcal == null) continue;
        const isLiquid = /\d\s*(ml|cl|l)\b/i.test(p.quantity ?? '');
        const unit: FoodResult['unit'] = isLiquid ? 'ml' : 'g';
        const brand = p.brands?.split(',')[0]?.trim().slice(0, 80) ?? null;
        add({ key: `product:${p.code}`, name: name.slice(0, 120), brand, unit, nutrients_per_100: nutrients, kind: 'product' });
        toCache.push({
          barcode: p.code,
          name: name.slice(0, 120),
          brand,
          unit,
          nutrients_per_100: nutrients,
          source: 'open_food_facts',
          verified: false,
        });
      }
      // Cache for instant future searches + barcode scans.
      if (toCache.length > 0) await service.from('barcode_products').upsert(toCache, { onConflict: 'barcode' });
    }
  } catch {
    // Ignore OFF errors — local results still returned.
  }

  return jsonResponse({ results: results.slice(0, 20) });
});

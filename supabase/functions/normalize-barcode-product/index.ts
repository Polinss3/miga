import { getUser, serviceClient } from '../_shared/db.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';

/**
 * Barcode lookup with Open Food Facts as the free source of truth.
 * The normalized product is cached in the global barcode_products catalog
 * (service-role write — clients can only read it), so each barcode hits
 * OFF at most once. No AI, no premium gate: barcode scanning is free-tier.
 */

interface OffProduct {
  product_name?: string;
  brands?: string;
  quantity?: string;
  nutriments?: Record<string, number | string>;
}

function toNumber(value: number | string | undefined): number | undefined {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? (n as number) : undefined;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const user = await getUser(req);
  if (!user) return errorResponse('unauthorized');

  const body = await req.json().catch(() => null);
  const barcode = typeof body?.barcode === 'string' ? body.barcode.replace(/\D/g, '') : '';
  if (!barcode || barcode.length < 6 || barcode.length > 14) {
    return errorResponse('invalid_request', 'invalid barcode');
  }

  const service = serviceClient();

  // Cached already? (Race with the client-side check is harmless.)
  const { data: cached } = await service
    .from('barcode_products')
    .select('barcode, name, brand, unit, serving_size, nutrients_per_100, source, verified')
    .eq('barcode', barcode)
    .maybeSingle();
  if (cached) return jsonResponse({ product: cached });

  const offResponse = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,nutriments`,
    { headers: { 'User-Agent': 'Miga/1.0 (nutrition app; contact via repo)' } },
  );
  if (!offResponse.ok) return jsonResponse({ product: null });

  const off = await offResponse.json();
  const product = off?.product as OffProduct | undefined;
  if (off?.status !== 1 || !product?.product_name) return jsonResponse({ product: null });

  const nutriments = product.nutriments ?? {};
  const isLiquid = /\d\s*(ml|cl|l)\b/i.test(product.quantity ?? '');
  const kcal =
    toNumber(nutriments['energy-kcal_100g']) ??
    (toNumber(nutriments['energy_100g']) != null ? toNumber(nutriments['energy_100g'])! / 4.184 : undefined);

  const normalized = {
    barcode,
    name: product.product_name.slice(0, 120),
    brand: product.brands?.split(',')[0]?.trim().slice(0, 80) ?? null,
    unit: isLiquid ? 'ml' : 'g',
    serving_size: toNumber(nutriments['serving_quantity']) ?? null,
    nutrients_per_100: {
      ...(kcal != null ? { kcal: Math.round(kcal) } : {}),
      ...(toNumber(nutriments['proteins_100g']) != null ? { protein_g: toNumber(nutriments['proteins_100g']) } : {}),
      ...(toNumber(nutriments['carbohydrates_100g']) != null
        ? { carbs_g: toNumber(nutriments['carbohydrates_100g']) }
        : {}),
      ...(toNumber(nutriments['fat_100g']) != null ? { fat_g: toNumber(nutriments['fat_100g']) } : {}),
      ...(toNumber(nutriments['fiber_100g']) != null ? { fiber_g: toNumber(nutriments['fiber_100g']) } : {}),
      ...(toNumber(nutriments['sugars_100g']) != null ? { sugar_g: toNumber(nutriments['sugars_100g']) } : {}),
      ...(toNumber(nutriments['sodium_100g']) != null
        ? { sodium_mg: Math.round(toNumber(nutriments['sodium_100g'])! * 1000) }
        : {}),
    },
    source: 'open_food_facts',
    verified: false,
  };

  await service.from('barcode_products').upsert(normalized, { onConflict: 'barcode' });
  return jsonResponse({ product: normalized });
});

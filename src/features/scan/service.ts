import { callAiFunction, imageUriToBase64 } from '@/lib/ai/client';
import { supabase } from '@/lib/supabase/client';
import {
  foodPhotoAnalysisSchema,
  nutritionLabelSchema,
  receiptAnalysisSchema,
  type FoodPhotoAnalysis,
  type NutritionLabelAnalysis,
  type ReceiptAnalysis,
} from '@/types/ai';
import type { BarcodeProduct } from '@/types/domain';

/**
 * Scan flows. Images are sent as base64 to Edge Functions, processed by the
 * AI provider and never persisted server-side (see docs/privacy.md); only the
 * validated structured result is stored.
 */

export async function lookupBarcode(barcode: string): Promise<BarcodeProduct | null> {
  // 1. Our own normalized catalog first (fast, free).
  const { data } = await supabase
    .from('barcode_products')
    .select('barcode, name, brand, unit, serving_size, nutrients_per_100, source, verified')
    .eq('barcode', barcode)
    .maybeSingle();
  if (data) return data as BarcodeProduct;

  // 2. Fall back to the Edge Function, which queries Open Food Facts and
  //    normalizes + caches the product globally (service-role write).
  // A failed invocation (network, function down) must NOT read as "product
  // not found" — let the caller show a retryable error instead.
  const { data: fnData, error } = await supabase.functions.invoke('normalize-barcode-product', {
    body: { barcode },
  });
  if (error) throw error;
  return (fnData?.product as BarcodeProduct | undefined) ?? null;
}

export async function analyzeFoodPhoto(
  imageUri: string,
  mode: 'fast' | 'precise',
): Promise<FoodPhotoAnalysis> {
  const image_base64 = await imageUriToBase64(imageUri);
  return callAiFunction('analyze-food-image', { image_base64, mode }, foodPhotoAnalysisSchema);
}

export async function analyzeReceipt(imageUri: string): Promise<ReceiptAnalysis> {
  const image_base64 = await imageUriToBase64(imageUri);
  return callAiFunction('analyze-receipt-image', { image_base64 }, receiptAnalysisSchema);
}

export async function analyzeNutritionLabel(imageUri: string): Promise<NutritionLabelAnalysis> {
  const image_base64 = await imageUriToBase64(imageUri);
  return callAiFunction('analyze-nutrition-label', { image_base64 }, nutritionLabelSchema);
}

/** Persist a confirmed receipt: stores structured rows + inventory items via RPC. */
export async function confirmReceipt(analysis: ReceiptAnalysis): Promise<void> {
  const { error } = await supabase.rpc('confirm_receipt', {
    p_store: analysis.store ?? null,
    p_date: analysis.date ?? null,
    p_total: analysis.total ?? null,
    p_currency: analysis.currency ?? null,
    p_items: analysis.items.filter((item) => item.is_food),
  });
  if (error) throw error;
}

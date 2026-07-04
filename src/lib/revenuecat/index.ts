import { Platform } from 'react-native';

/**
 * RevenueCat wrapper.
 *
 * react-native-purchases is a native module, so it is unavailable in Expo Go.
 * Every function here degrades gracefully: in Expo Go the app behaves like a
 * free account and the paywall explains that purchases need the real build.
 *
 * IMPORTANT: the client entitlement is for UI only (showing/hiding paywalls).
 * The backend re-validates premium via the `subscriptions` table (kept fresh
 * by the RevenueCat webhook) before running any paid AI operation.
 */

export const PREMIUM_ENTITLEMENT = 'premium';

type PurchasesModule = typeof import('react-native-purchases').default;

let purchases: PurchasesModule | null = null;

function loadPurchases(): PurchasesModule | null {
  if (purchases) return purchases;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded optional native module (unavailable in Expo Go)
    purchases = require('react-native-purchases').default as PurchasesModule;
    return purchases;
  } catch {
    return null; // Expo Go or web
  }
}

export function isPurchasesAvailable(): boolean {
  return loadPurchases() != null;
}

export async function configurePurchases(appUserId: string): Promise<void> {
  const rc = loadPurchases();
  if (!rc) return;
  const apiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  });
  if (!apiKey) return;
  // appUserID = Supabase user id → the webhook can map events to our user.
  rc.configure({ apiKey, appUserID: appUserId });
}

export async function hasPremiumEntitlement(): Promise<boolean> {
  const rc = loadPurchases();
  if (!rc) return false;
  try {
    const info = await rc.getCustomerInfo();
    return info.entitlements.active[PREMIUM_ENTITLEMENT] != null;
  } catch {
    return false;
  }
}

export interface PremiumPackage {
  identifier: string;
  priceString: string;
  period: 'monthly' | 'yearly' | 'other';
}

export async function getPremiumPackages(): Promise<PremiumPackage[]> {
  const rc = loadPurchases();
  if (!rc) return [];
  try {
    const offerings = await rc.getOfferings();
    const current = offerings.current;
    if (!current) return [];
    return current.availablePackages.map((pkg) => ({
      identifier: pkg.identifier,
      priceString: pkg.product.priceString,
      period:
        pkg.packageType === 'MONTHLY' ? 'monthly' : pkg.packageType === 'ANNUAL' ? 'yearly' : 'other',
    }));
  } catch {
    return [];
  }
}

export async function purchasePremium(packageIdentifier: string): Promise<boolean> {
  const rc = loadPurchases();
  if (!rc) return false;
  const offerings = await rc.getOfferings();
  const pkg = offerings.current?.availablePackages.find((p) => p.identifier === packageIdentifier);
  if (!pkg) return false;
  const { customerInfo } = await rc.purchasePackage(pkg);
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT] != null;
}

export async function restorePurchases(): Promise<boolean> {
  const rc = loadPurchases();
  if (!rc) return false;
  const info = await rc.restorePurchases();
  return info.entitlements.active[PREMIUM_ENTITLEMENT] != null;
}

export async function logOutPurchases(): Promise<void> {
  const rc = loadPurchases();
  if (!rc) return;
  try {
    await rc.logOut();
  } catch {
    // Already anonymous — nothing to do.
  }
}

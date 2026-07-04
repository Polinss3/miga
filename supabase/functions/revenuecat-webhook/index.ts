import { serviceClient } from '../_shared/db.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';

/**
 * RevenueCat → subscriptions webhook.
 *
 * Configure in the RevenueCat dashboard with an Authorization header equal to
 * the REVENUECAT_WEBHOOK_AUTH secret, and deploy with:
 *   supabase functions deploy revenuecat-webhook --no-verify-jwt
 *
 * app_user_id is the Supabase user id (set by configurePurchases in the app),
 * so events map 1:1 to users. This table is THE server-side source of truth
 * for premium — the client entitlement is never trusted.
 */

const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
]);
const EXPIRED_EVENTS = new Set(['EXPIRATION']);
const BILLING_EVENTS = new Set(['BILLING_ISSUE']);
const CANCELLED_EVENTS = new Set(['CANCELLATION']);

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!expectedAuth || req.headers.get('Authorization') !== expectedAuth) {
    return errorResponse('unauthorized');
  }

  const body = await req.json().catch(() => null);
  const event = body?.event;
  if (!event?.type || typeof event?.app_user_id !== 'string') {
    return errorResponse('invalid_request');
  }

  // Ignore RevenueCat anonymous ids — we always configure with the user id.
  const userId = event.app_user_id;
  if (userId.startsWith('$RCAnonymousID:')) return jsonResponse({ ok: true, skipped: true });

  let status: 'active' | 'expired' | 'billing_issue' | 'cancelled' | null = null;
  if (ACTIVE_EVENTS.has(event.type)) status = 'active';
  else if (EXPIRED_EVENTS.has(event.type)) status = 'expired';
  else if (BILLING_EVENTS.has(event.type)) status = 'billing_issue';
  else if (CANCELLED_EVENTS.has(event.type)) status = 'cancelled'; // access continues until period_end

  if (!status) return jsonResponse({ ok: true, ignored: event.type });

  const service = serviceClient();
  const { error } = await service.from('subscriptions').upsert(
    {
      user_id: userId,
      // A cancelled auto-renew keeps entitlement until expiration.
      status: status === 'cancelled' ? 'active' : status,
      entitlement: 'premium',
      store: event.store ?? null,
      rc_app_user_id: userId,
      period_end: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    },
    { onConflict: 'user_id' },
  );
  if (error) return errorResponse('provider_error', error.message);

  return jsonResponse({ ok: true });
});

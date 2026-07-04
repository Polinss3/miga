import type { SupabaseClient, User } from '@supabase/supabase-js';

import { getUser, serviceClient } from './db.ts';
import { errorResponse } from './http.ts';

export interface AiRequestContext {
  user: User;
  service: SupabaseClient;
  requestId: string;
}

/**
 * Server-side premium/quota enforcement — runs before EVERY model call.
 *
 * 1. Authenticates the JWT.
 * 2. consume_ai_quota_if_needed(): passes premium users through, decrements
 *    the free monthly allowance otherwise, refuses when exhausted.
 * 3. Writes an ai_requests audit row (no image data, ever).
 *
 * The client-side gate (PremiumGate) is presentation only; this is the
 * actual boundary. Never trust the client for entitlements.
 */
export async function authorizeAiRequest(
  req: Request,
  kind: string,
): Promise<AiRequestContext | Response> {
  const user = await getUser(req);
  if (!user) return errorResponse('unauthorized');

  const service = serviceClient();

  const { data: allowed, error: quotaError } = await service.rpc('consume_ai_quota_if_needed', {
    p_user: user.id,
  });
  if (quotaError) return errorResponse('provider_error', quotaError.message);
  if (!allowed) return errorResponse('quota_exceeded');

  const { data: request, error: insertError } = await service
    .from('ai_requests')
    .insert({ user_id: user.id, kind, status: 'ok' })
    .select('id')
    .single();
  if (insertError) return errorResponse('provider_error', insertError.message);

  return { user, service, requestId: request.id as string };
}

/** Persist the validated result and (on failure) flag the audit row. */
export async function recordAiResult(
  context: AiRequestContext,
  payload: unknown,
): Promise<void> {
  await context.service.from('ai_results').insert({ request_id: context.requestId, payload });
}

export async function recordAiFailure(context: AiRequestContext, code: string): Promise<void> {
  await context.service
    .from('ai_requests')
    .update({ status: 'error', error_code: code })
    .eq('id', context.requestId);
}

const MAX_IMAGE_BASE64_LENGTH = 8_000_000; // ~6 MB binary

export function validateImagePayload(base64: unknown): string | null {
  if (typeof base64 !== 'string' || base64.length === 0) return null;
  if (base64.length > MAX_IMAGE_BASE64_LENGTH) return null;
  return base64.replace(/^data:image\/\w+;base64,/, '');
}

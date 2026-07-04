export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export type ErrorCode =
  | 'unauthorized'
  | 'premium_required'
  | 'quota_exceeded'
  | 'invalid_request'
  | 'invalid_response'
  | 'not_food'
  | 'provider_error'
  | 'not_found';

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  premium_required: 402,
  quota_exceeded: 429,
  invalid_request: 400,
  invalid_response: 502,
  not_food: 422,
  provider_error: 502,
  not_found: 404,
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(code: ErrorCode, message?: string): Response {
  return jsonResponse({ error: { code, message: message ?? code } }, STATUS[code]);
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return null;
}

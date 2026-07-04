import type { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/**
 * Client-side entry point for every AI feature.
 *
 * All model calls happen inside Supabase Edge Functions (never on-device),
 * behind premium/quota checks. The provider (OpenAI / Anthropic / Gemini) is
 * chosen server-side via the AI_PROVIDER secret, so the app never knows or
 * cares which LLM answered. Responses are validated against a zod schema
 * before they reach any screen.
 */

export type AiErrorCode =
  | 'premium_required'
  | 'quota_exceeded'
  | 'invalid_response'
  | 'not_food'
  | 'network'
  | 'unknown';

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AiError';
  }
}

interface EdgeErrorBody {
  error?: { code?: string; message?: string };
}

export async function callAiFunction<Schema extends z.ZodTypeAny>(
  functionName: string,
  payload: Record<string, unknown>,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const { data, error } = await supabase.functions.invoke(functionName, { body: payload });

  if (error) {
    // Supabase FunctionsHttpError carries the response; map known codes.
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = (await context.json()) as EdgeErrorBody;
        const code = body.error?.code;
        if (code === 'premium_required' || code === 'quota_exceeded' || code === 'not_food') {
          throw new AiError(code, body.error?.message);
        }
        // Preserve any other server code's message so callers can branch on it.
        if (code) {
          throw new AiError('unknown', body.error?.message ?? code);
        }
      } catch (parseError) {
        if (parseError instanceof AiError) throw parseError;
      }
    }
    throw new AiError('network', error.message);
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AiError('invalid_response', parsed.error.message);
  }
  return parsed.data;
}

/** Convert a local image URI into a base64 payload for the Edge Functions. */
export async function imageUriToBase64(uri: string): Promise<string> {
  const { File } = await import('expo-file-system');
  const file = new File(uri);
  return file.base64();
}

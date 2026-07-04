/**
 * Provider-agnostic AI layer.
 *
 * Every Edge Function talks to this interface only. The concrete provider
 * (OpenAI / Anthropic / Gemini / any OpenAI-compatible API) is selected with
 * env secrets — swapping providers is a config change, not a code change:
 *
 *   supabase secrets set AI_PROVIDER=openai   AI_MODEL=gpt-5-nano
 *   supabase secrets set AI_PROVIDER=anthropic AI_MODEL=claude-haiku-4-5
 *   supabase secrets set AI_PROVIDER=gemini    AI_MODEL=gemini-2.5-flash
 */

export interface AiTextPart {
  type: 'text';
  text: string;
}

export interface AiImagePart {
  type: 'image';
  base64: string;
  mediaType: string; // e.g. image/jpeg
}

export type AiPart = AiTextPart | AiImagePart;

export interface AiMessage {
  role: 'user' | 'assistant';
  parts: AiPart[];
}

export interface AiGenerateRequest {
  system: string;
  messages: AiMessage[];
  /** Ask the provider for a JSON object response. */
  json: boolean;
  maxTokens?: number;
  temperature?: number;
  /**
   * Reasoning budget for reasoning models (GPT-5 / o-series). Defaults to
   * 'minimal' for GPT-5 (fast, cheap). Raise it for complex, multi-step
   * outputs like a full week meal plan.
   */
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generate(request: AiGenerateRequest): Promise<string>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

/** Extract the first JSON object from a model reply (tolerates code fences). */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new AiProviderError('no_json_in_response');
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

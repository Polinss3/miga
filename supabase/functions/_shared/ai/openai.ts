import { AiProviderError, type AiGenerateRequest, type AiProvider } from './types.ts';

/**
 * OpenAI adapter (Chat Completions). Also works with any OpenAI-compatible
 * endpoint (Azure, OpenRouter, local gateways) via OPENAI_BASE_URL.
 */
export function createOpenAiProvider(model: string): AiProvider {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const baseUrl = Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1';
  if (!apiKey) throw new AiProviderError('OPENAI_API_KEY not configured');

  // GPT-5 and the o-series reasoning models only accept the default temperature
  // (1) and return a 400 for any explicit value — so we must omit it for them.
  const isGpt5 = /^gpt-5/.test(model);
  const isReasoningModel = isGpt5 || /^o[1-9]/.test(model);
  const supportsTemperature = !isReasoningModel;

  return {
    name: 'openai',
    model,
    async generate(request: AiGenerateRequest): Promise<string> {
      // GPT-5 defaults to spending a variable, often large budget on hidden
      // reasoning tokens — slow responses and sometimes an empty completion.
      // Default to 'minimal' (fast) but let callers raise it for complex jobs
      // like a full-week plan. o-series can't use 'minimal', so floor at 'low'.
      const requestedEffort = request.reasoningEffort ?? (isGpt5 ? 'minimal' : undefined);
      const reasoningEffort = isReasoningModel
        ? requestedEffort === 'minimal' && !isGpt5
          ? 'low'
          : requestedEffort
        : undefined;

      const messages = [
        { role: 'system', content: request.system },
        ...request.messages.map((message) => ({
          role: message.role,
          content: message.parts.map((part) =>
            part.type === 'text'
              ? { type: 'text', text: part.text }
              : { type: 'image_url', image_url: { url: `data:${part.mediaType};base64,${part.base64}` } },
          ),
        })),
      ];

      // Fail fast on a hung upstream so the client gets a clean, retryable
      // error instead of hanging until the Edge Function is killed.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55_000);

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages,
            max_completion_tokens: request.maxTokens ?? 4000,
            ...(request.temperature != null && supportsTemperature
              ? { temperature: request.temperature }
              : {}),
            ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
            ...(request.json ? { response_format: { type: 'json_object' } } : {}),
          }),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new AiProviderError('openai_timeout', 504);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new AiProviderError(`openai_error: ${await response.text()}`, response.status);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content) throw new AiProviderError('openai_empty_response');
      return content;
    },
  };
}

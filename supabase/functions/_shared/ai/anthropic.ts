import { AiProviderError, type AiGenerateRequest, type AiProvider } from './types.ts';

/** Anthropic Messages API adapter. */
export function createAnthropicProvider(model: string): AiProvider {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new AiProviderError('ANTHROPIC_API_KEY not configured');

  return {
    name: 'anthropic',
    model,
    async generate(request: AiGenerateRequest): Promise<string> {
      const system = request.json
        ? `${request.system}\n\nRespond with a single valid JSON object and nothing else.`
        : request.system;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          system,
          max_tokens: request.maxTokens ?? 4000,
          temperature: request.temperature ?? (request.json ? 0.2 : 0.7),
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.parts.map((part) =>
              part.type === 'text'
                ? { type: 'text', text: part.text }
                : {
                    type: 'image',
                    source: { type: 'base64', media_type: part.mediaType, data: part.base64 },
                  },
            ),
          })),
        }),
      });

      if (!response.ok) {
        throw new AiProviderError(`anthropic_error: ${await response.text()}`, response.status);
      }
      const data = await response.json();
      const text = data.content?.find((block: { type: string }) => block.type === 'text')?.text;
      if (typeof text !== 'string' || !text) throw new AiProviderError('anthropic_empty_response');
      return text;
    },
  };
}

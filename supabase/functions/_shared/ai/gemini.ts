import { AiProviderError, type AiGenerateRequest, type AiProvider } from './types.ts';

/** Google Gemini adapter (Generative Language API). */
export function createGeminiProvider(model: string): AiProvider {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new AiProviderError('GOOGLE_AI_API_KEY not configured');

  return {
    name: 'gemini',
    model,
    async generate(request: AiGenerateRequest): Promise<string> {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.system }] },
            contents: request.messages.map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: message.parts.map((part) =>
                part.type === 'text'
                  ? { text: part.text }
                  : { inlineData: { mimeType: part.mediaType, data: part.base64 } },
              ),
            })),
            generationConfig: {
              maxOutputTokens: request.maxTokens ?? 4000,
              temperature: request.temperature ?? (request.json ? 0.2 : 0.7),
              ...(request.json ? { responseMimeType: 'application/json' } : {}),
            },
          }),
        },
      );

      if (!response.ok) {
        throw new AiProviderError(`gemini_error: ${await response.text()}`, response.status);
      }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
      if (typeof text !== 'string' || !text) throw new AiProviderError('gemini_empty_response');
      return text;
    },
  };
}

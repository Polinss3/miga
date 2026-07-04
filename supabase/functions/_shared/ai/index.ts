import { createAnthropicProvider } from './anthropic.ts';
import { createGeminiProvider } from './gemini.ts';
import { createOpenAiProvider } from './openai.ts';
import { AiProviderError, type AiProvider } from './types.ts';

export * from './types.ts';

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-5-nano',
  anthropic: 'claude-haiku-4-5',
  gemini: 'gemini-2.5-flash',
};

/** Factory: reads AI_PROVIDER / AI_MODEL secrets. */
export function getAiProvider(): AiProvider {
  const providerName = (Deno.env.get('AI_PROVIDER') ?? 'openai').toLowerCase();
  const model = Deno.env.get('AI_MODEL') ?? DEFAULT_MODELS[providerName];
  if (!model) throw new AiProviderError(`unknown provider: ${providerName}`);

  switch (providerName) {
    case 'openai':
      return createOpenAiProvider(model);
    case 'anthropic':
      return createAnthropicProvider(model);
    case 'gemini':
      return createGeminiProvider(model);
    default:
      throw new AiProviderError(`unknown provider: ${providerName}`);
  }
}

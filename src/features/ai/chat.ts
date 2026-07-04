import { callAiFunction } from '@/lib/ai/client';
import { chatReplySchema, type ChatReply } from '@/types/ai';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
}

/**
 * Advisor chat. The Edge Function injects the user's profile, goals, today's
 * totals and pantry summary as context, applies the safety system prompt
 * (docs/ai-safety.md) and logs the request in ai_requests server-side.
 * Conversation history is kept client-side only.
 */
export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
): Promise<ChatReply> {
  return callAiFunction(
    'ai-chat',
    {
      message,
      history: history.slice(-10).map((m) => ({ role: m.role, text: m.text })),
    },
    chatReplySchema,
  );
}

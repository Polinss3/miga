import * as Crypto from 'expo-crypto';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Card, Icon, TextField } from '@/components/ui';
import { sendChatMessage, type ChatMessage } from '@/features/ai/chat';
import { AiError } from '@/lib/ai/client';
import { useTheme } from '@/theme';

/**
 * Bounded advisor chat. Miga is screens-first: the chat is a helper, and
 * anything actionable the model suggests routes back into the closed flows.
 */
export default function AiChatScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);

  const suggestions = t('ai.suggestions', { returnObjects: true }) as string[];

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    const userMessage: ChatMessage = {
      id: Crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setDraft('');
    setThinking(true);

    try {
      const reply = await sendChatMessage(trimmed, messages);
      setMessages((prev) => [
        ...prev,
        { id: Crypto.randomUUID(), role: 'assistant', text: reply.reply, createdAt: new Date().toISOString() },
      ]);
    } catch (error) {
      const messageKey =
        error instanceof AiError && error.code === 'premium_required'
          ? 'ai.premiumNote'
          : error instanceof AiError && error.code === 'quota_exceeded'
            ? 'ai.rateLimited'
            : 'ai.error';
      setMessages((prev) => [
        ...prev,
        { id: Crypto.randomUUID(), role: 'assistant', text: t(messageKey), createdAt: new Date().toISOString() },
      ]);
    } finally {
      setThinking(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <View style={{ flex: 1, paddingTop: theme.spacing.xl }}>
        <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.xs }}>
          <AppText variant="title2">{t('ai.title')}</AppText>
          <AppText variant="caption" color="tertiary">
            {t('ai.disclaimer')}
          </AppText>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.xl }}>
              <AppText variant="title3" style={{ textAlign: 'center' }}>
                {t('ai.emptyTitle')}
              </AppText>
              {suggestions.map((suggestion) => (
                <Card key={suggestion} onPress={() => void send(suggestion)} muted>
                  <AppText variant="subhead">{suggestion}</AppText>
                </Card>
              ))}
            </View>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  backgroundColor: message.role === 'user' ? theme.colors.accent : theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.md,
                  borderWidth: message.role === 'assistant' && !theme.isDark ? 1 : 0,
                  borderColor: theme.colors.border,
                }}
              >
                <AppText
                  variant="body"
                  style={{ color: message.role === 'user' ? theme.colors.textOnAccent : theme.colors.text }}
                >
                  {message.text}
                </AppText>
              </View>
            ))
          )}
          {thinking ? (
            <AppText variant="subhead" color="tertiary">
              {t('ai.thinking')}
            </AppText>
          ) : null}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            padding: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.lg,
          }}
        >
          <View style={{ flex: 1 }}>
            <TextField
              placeholder={t('ai.placeholder')}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => void send(draft)}
              returnKeyType="send"
            />
          </View>
          <Pressable onPress={() => void send(draft)} hitSlop={8} accessibilityRole="button" disabled={thinking}>
            <Icon name="send" size={34} color={draft.trim() && !thinking ? theme.colors.accent : theme.colors.textTertiary} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

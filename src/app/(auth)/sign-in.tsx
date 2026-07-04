import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createSessionFromUrl,
  signInWithApple,
  signInWithGoogle,
  signInWithMagicLink,
} from '@/features/auth/service';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import { useTheme } from '@/theme';

function getAuthErrorDetail(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'Unknown auth error';
}

export default function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const url = Linking.useURL();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Handle the magic-link deep link while this screen is open.
  useEffect(() => {
    if (url?.includes('access_token') || url?.includes('code=')) {
      createSessionFromUrl(url).catch((error) => {
        console.error('[auth] callback failed:', error);
        Alert.alert(t('auth.authError'), getAuthErrorDetail(error));
      });
    }
  }, [url, t]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }
  }, []);

  const handleMagicLink = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setEmailError(t('auth.invalidEmail'));
      return;
    }
    setEmailError(undefined);
    setSending(true);
    try {
      await signInWithMagicLink(trimmed);
      setSentTo(trimmed);
    } catch (error) {
      console.error('[auth] magic link failed:', error);
      Alert.alert(t('auth.authError'), getAuthErrorDetail(error));
    } finally {
      setSending(false);
    }
  };

  const handleProvider = async (provider: 'apple' | 'google') => {
    try {
      await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
    } catch (error) {
      // User-cancelled Apple sign in throws ERR_REQUEST_CANCELED — ignore it.
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        console.error('[auth] provider failed:', error);
        Alert.alert(t('auth.authError'), getAuthErrorDetail(error));
      }
    }
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          padding: theme.spacing.xl,
          paddingTop: insets.top + theme.spacing.xxxl,
          paddingBottom: insets.bottom + theme.spacing.xl,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ gap: theme.spacing.md }}>
          <AppText variant="largeTitle">{t('auth.welcomeTitle')}</AppText>
          <AppText variant="body" color="secondary">
            {t('auth.welcomeSubtitle')}
          </AppText>
        </View>

        {sentTo ? (
          <View style={{ gap: theme.spacing.md }}>
            <AppText variant="title2">{t('auth.magicLinkSentTitle')}</AppText>
            <AppText variant="body" color="secondary">
              {t('auth.magicLinkSentBody', { email: sentTo })}
            </AppText>
            <Button label={t('common.back')} variant="ghost" onPress={() => setSentTo(null)} />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.lg }}>
            <TextField
              label={t('auth.emailLabel')}
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              error={emailError}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="go"
              onSubmitEditing={handleMagicLink}
            />
            <Button label={t('auth.sendMagicLink')} onPress={handleMagicLink} loading={sending} size="lg" />

            <AppText variant="footnote" color="tertiary" style={{ textAlign: 'center' }}>
              {t('auth.orSeparator')}
            </AppText>

            {appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={
                  scheme === 'dark'
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={theme.radius.full}
                style={{ height: 50 }}
                onPress={() => handleProvider('apple')}
              />
            ) : null}
            <Button
              label={t('auth.continueWithGoogle')}
              variant="secondary"
              size="lg"
              onPress={() => handleProvider('google')}
            />

            <AppText variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
              {t('auth.legalNotice')}
            </AppText>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

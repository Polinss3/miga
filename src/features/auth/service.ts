import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { assertSupabaseConfigured, supabase } from '@/lib/supabase/client';

/**
 * Auth flows.
 *
 * Account linking: Supabase links identities that share a *verified* email
 * into one user when "Link identities automatically" is enabled (Dashboard →
 * Auth → Providers). Apple and Google both return verified emails, and magic
 * links prove ownership by definition, so the same email always resolves to
 * the same Miga account. docs/architecture.md covers the required dashboard
 * settings.
 */

WebBrowser.maybeCompleteAuthSession();

const redirectTo =
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ??
  makeRedirectUri({
    scheme: 'miga',
    path: 'auth/callback',
    native: 'miga://auth/callback',
  });

if (__DEV__) {
  console.log('[auth] redirect URL:', redirectTo);
}

export async function signInWithMagicLink(email: string): Promise<void> {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

/** Handle the deep link that the magic-link email opens. */
export async function createSessionFromUrl(url: string): Promise<boolean> {
  assertSupabaseConfigured();
  const { params, errorCode } = getUrlParams(url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token, code } = params;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return true;
}

function getUrlParams(url: string): { params: Record<string, string>; errorCode: string | null } {
  const parsed = Linking.parse(url);
  const params: Record<string, string> = {};
  // Tokens arrive in the URL fragment for implicit flows.
  const fragment = url.split('#')[1];
  if (fragment) {
    for (const pair of fragment.split('&')) {
      const [key, value] = pair.split('=');
      if (key && value) params[key] = decodeURIComponent(value);
    }
  }
  for (const [key, value] of Object.entries(parsed.queryParams ?? {})) {
    if (typeof value === 'string') params[key] = value;
  }
  return { params, errorCode: params.error_code ?? null };
}

export async function signInWithApple(): Promise<void> {
  assertSupabaseConfigured();
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('apple_no_identity_token');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('google_no_auth_url');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await createSessionFromUrl(result.url);
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_BASE_URL } from '@/utils/api';

const TELEGRAM_BOT_USERNAME = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME || 'gebaaibot';

export interface TelegramUser {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export async function openTelegramLogin(): Promise<TelegramUser | null> {
  const redirectUri = Linking.createURL('telegram-callback');

  // Using API_BASE_URL assuming the HTML is hosted on the backend server or adjusting it later.
  const appUrl = process.env.EXPO_PUBLIC_APP_URL || API_BASE_URL;
  const authUrl = `${appUrl}/telegram-mobile-auth.html?redirect_uri=${encodeURIComponent(redirectUri)}&bot_name=${TELEGRAM_BOT_USERNAME}`;

  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success' && result.url) {
      return parseTelegramCallback(result.url);
    }

    return null;
  } catch (error) {
    console.error('Telegram login failed:', error);
    return null;
  }
}

function parseTelegramCallback(url: string): TelegramUser | null {
  try {
    const parsed = Linking.parse(url);
    const params = parsed.queryParams;

    if (!params?.id || !params?.hash || !params?.auth_date) {
      return null;
    }

    return {
      id: String(params.id),
      first_name: String(params.first_name || ''),
      last_name: params.last_name ? String(params.last_name) : undefined,
      username: params.username ? String(params.username) : undefined,
      photo_url: params.photo_url ? String(params.photo_url) : undefined,
      auth_date: Number(params.auth_date),
      hash: String(params.hash),
    };
  } catch {
    return null;
  }
}

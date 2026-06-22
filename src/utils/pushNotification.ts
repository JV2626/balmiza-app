import { Platform, Alert } from 'react-native';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export const sendPushNotification = async (
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
) => {
  if (Platform.OS === 'web') {
    // Push not available on web; silently skip
    console.log('[Push skipped on web]', title, body);
    return;
  }

  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
    console.warn('[Push] Token inválido ou ausente:', expoPushToken);
    return;
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data: data || {},
      }),
    });
    const result = await response.json();
    console.log('[Push sent]', result);
  } catch (e) {
    console.warn('[Push error]', e);
  }
};

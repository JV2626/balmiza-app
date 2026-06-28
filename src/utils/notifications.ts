import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';

// Configurar como as notificações aparecem quando o app está em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registra o dispositivo para receber push notifications e salva o token no Firestore.
 * Deve ser chamado após o login do usuário.
 */
export const registerForPushNotifications = async (userEmail: string): Promise<string | null> => {
  if (!Device.isDevice && Platform.OS !== 'web') {
    console.log('Push notifications requerem um dispositivo físico.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permissão de notificação negada.');
      return null;
    }

    // Obter token Expo Push
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '9a371ac6-7586-4c1c-8b60-aafef3456b58', // EAS Project ID do app.json
    });
    const token = tokenData.data;

    // Salvar token no Firestore vinculado ao email do usuário
    if (userEmail && token) {
      const db = getFirebaseDb();
      await setDoc(
        doc(db, 'usuarios', userEmail.toLowerCase().trim()),
        { pushToken: token },
        { merge: true }
      );
    }

    // Configurar canal de notificação no Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('balmiza-default', {
        name: 'Balmiza',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#DF0A0A',
      });
    }

    return token;
  } catch (e) {
    console.log('Erro ao registrar push notifications:', e);
    return null;
  }
};

/**
 * Envia uma notificação push para um token específico via Expo Push Service.
 * Chama o endpoint /api/notify do servidor Vercel.
 */
export const sendPushNotification = async (
  expoPushToken: string,
  title: string,
  body: string,
  data?: object
): Promise<void> => {
  const apiUrl = Platform.OS === 'web'
    ? '/api/notify'
    : (process.env.EXPO_PUBLIC_API_URL || 'https://balmiza-app.vercel.app') + '/api/notify';

  try {
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expoPushToken, title, body, data: data || {} }),
    });
  } catch (e) {
    console.log('Erro ao enviar push notification:', e);
  }
};

/**
 * Envia notificação para múltiplos tokens de uma vez.
 */
export const sendPushToMultiple = async (
  tokens: string[],
  title: string,
  body: string,
  data?: object
): Promise<void> => {
  if (!tokens || tokens.length === 0) return;
  const validTokens = tokens.filter(t => t && t.startsWith('ExponentPushToken'));
  await Promise.all(validTokens.map(token => sendPushNotification(token, title, body, data)));
};

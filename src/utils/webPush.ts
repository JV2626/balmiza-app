import { Platform } from 'react-native';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || '';

// Converter chave VAPID base64 para UInt8Array necessária para a API do navegador
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Solicita permissão e gera a inscrição (PushSubscription) no navegador.
 * Salva a inscrição no Firestore para podermos enviar notificações.
 */
export const registerWebPush = async (userEmail: string): Promise<boolean> => {
  if (Platform.OS !== 'web') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Este navegador não suporta Web Push.');
    return false;
  }

  try {
    // 1. Requisitar permissão se necessário
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permissão de notificação negada pelo usuário.');
      return false;
    }

    // 2. Garantir que o service worker está ativo
    const registration = await navigator.serviceWorker.ready;

    // 3. Gerar a assinatura
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    };

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe(subscribeOptions);
    }

    // 4. Salvar no Firestore
    const db = getFirebaseDb();
    const cleanEmail = userEmail.toLowerCase().trim();
    
    // Convertemos a subscription para JSON simples
    const subscriptionJson = subscription.toJSON();
    
    await setDoc(
      doc(db, 'usuarios', cleanEmail),
      { webPushSubscription: subscriptionJson },
      { merge: true }
    );

    console.log('Web Push inscrito com sucesso!');
    return true;
  } catch (e) {
    console.log('Erro ao inscrever no Web Push:', e);
    return false;
  }
};

/**
 * Remove a inscrição de Web Push do navegador e limpa no Firestore.
 */
export const unregisterWebPush = async (userEmail: string): Promise<boolean> => {
  if (Platform.OS !== 'web') return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    // Remover do Firestore
    const db = getFirebaseDb();
    const cleanEmail = userEmail.toLowerCase().trim();
    await setDoc(
      doc(db, 'usuarios', cleanEmail),
      { webPushSubscription: null },
      { merge: true }
    );

    console.log('Web Push desinscrito.');
    return true;
  } catch (e) {
    console.log('Erro ao desinscrever do Web Push:', e);
    return false;
  }
};

/**
 * Verifica se o navegador atual tem permissão concedida
 */
export const checkWebPushPermission = (): 'default' | 'denied' | 'granted' => {
  if (Platform.OS !== 'web') return 'denied';
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
};

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

export const getFirebaseApp = () => {
  if (!firebase.apps.length) {
    return firebase.initializeApp(firebaseConfig);
  }
  return firebase.app();
};

export const getFirebaseAuth = () => {
  const app = getFirebaseApp();
  return firebase.auth();
};

let dbInstance: any = null;
export const getFirebaseDb = () => {
  if (!dbInstance) {
    // Persistência offline: dados ficam em cache local mesmo sem internet
    // Funciona na JBS onde o sinal de celular é instável
    try {
      dbInstance = initializeFirestore(getFirebaseApp(), {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (e: any) {
      // Se já foi inicializado com outra config, reutiliza a instância existente
      const { getFirestore } = require('firebase/firestore');
      dbInstance = getFirestore(getFirebaseApp());
    }
  }
  return dbInstance;
};

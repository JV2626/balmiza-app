import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA7gKNXULnhUM-dww-1B9B6U49n2Guw2lw",
  authDomain: "balmiza-app.firebaseapp.com",
  projectId: "balmiza-app",
  storageBucket: "balmiza-app.firebasestorage.app",
  messagingSenderId: "337134984837",
  appId: "1:337134984837:web:a3f66672a464e89c3dd3ec",
  measurementId: "G-XSV8YRZRKJ"
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
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
};

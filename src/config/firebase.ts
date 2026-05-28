import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Configurações do Firebase (Placeholders - substitua pelas credenciais oficiais do seu console Firebase)
const firebaseConfig = {
    apiKey: "AIzaSyA7gKNXULnhUM-dww-1B9B6U49n2Guw2lw",
    authDomain: "balmiza-app.firebaseapp.com",
    projectId: "balmiza-app",
    storageBucket: "balmiza-app.firebasestorage.app",
    messagingSenderId: "337134984837",
    appId: "1:337134984837:web:a3f66672a464e89c3dd3ec",
    measurementId: "G-XSV8YRZRKJ"
  };

// Inicializa o App do Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore com cache offline persistente (Offline-First)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

const auth = getAuth(app);

export { app, db, auth };

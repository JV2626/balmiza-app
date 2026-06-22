import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

// Carregar variáveis de ambiente do .env manualmente no script Node
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.trim().startsWith('"') && value.trim().endsWith('"')) {
          value = value.trim().slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {
  console.error("Erro ao ler o arquivo .env no seed.mjs:", e);
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log("Seeding funcionarios...");
  const funcionarios = [
    { id: "F001", nome: "João Silva", endereco: "Rua das Flores, 123", setor: "Desossa" },
    { id: "F002", nome: "Maria Souza", endereco: "Av. Brasil, 456", setor: "Embalagem" },
    { id: "F003", nome: "José Santos", endereco: "Rua do Bosque, 789", setor: "Corte" },
    { id: "F004", nome: "Ana Costa", endereco: "Av. Principal, 100", setor: "Desossa" },
  ];

  for (const f of funcionarios) {
    await setDoc(doc(db, "funcionarios", f.id), f);
  }
  
  console.log("Seeding veiculos...");
  const veiculos = [
    { id: "V001", placa: "ABC-1234", modelo: "Gol", kmAtual: 14500, kmUltimaRevisao: 5000, ativo: true },
    { id: "V002", placa: "XYZ-9876", modelo: "Onix", kmAtual: 19800, kmUltimaRevisao: 10000, ativo: true }, // Quase na hora da revisão (+10k = 20k)
    { id: "V003", placa: "BAL-2024", modelo: "Argo", kmAtual: 2000, kmUltimaRevisao: 0, ativo: true },
  ];

  for (const v of veiculos) {
    await setDoc(doc(db, "veiculos", v.id), v);
  }

  console.log("Seeding completed!");
  process.exit(0);
}

seed();

import { Platform } from 'react-native';
import { GoogleGenAI } from '@google/genai';
import { getFirebaseAuth } from '../config/firebase';

export const callGeminiSecurely = async (
  prompt: string, 
  base64Image?: string, 
  mimeType?: string,
  schema?: any
): Promise<string> => {
  const localApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  // Se estiver rodando localmente em modo desenvolvimento e tiver chave local no .env, faz chamada direta no cliente
  if (__DEV__ && localApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: localApiKey });
      let parts: any[] = [{ text: prompt }];
      if (base64Image && mimeType) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Image
          }
        });
      }

      const config: any = {};
      if (schema) {
        config.responseMimeType = 'application/json';
        config.responseSchema = schema;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: config
      });

      return response.text || '';
    } catch (e) {
      console.log('Erro na chamada direta do Gemini (desenvolvimento), tentando via proxy...', e);
    }
  }

  // No navegador (Web), usamos rota relativa. No Mobile (Expo Go) produção, usamos a URL da API da Vercel
  const apiUrl = Platform.OS === 'web' 
    ? '/api/gemini' 
    : (process.env.EXPO_PUBLIC_API_URL || 'https://balmiza-app.vercel.app') + '/api/gemini';

  // Obter token de ID da sessão atual para autorizar chamada no servidor
  let idToken = '';
  try {
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }
  } catch (err) {
    console.log('Erro ao buscar token do Firebase para a IA', err);
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': idToken ? `Bearer ${idToken}` : ''
    },
    body: JSON.stringify({ prompt, base64Image, mimeType, schema })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Erro na requisição da Inteligência Artificial.');
  }

  const data = await response.json();
  return data.text || '';
};

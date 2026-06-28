const { GoogleGenAI } = require('@google/genai');
const crypto = require('crypto');
const https = require('https');

// Cache para certificados do Google
let googleCertificates = null;
let googleCertificatesExpiry = 0;

async function getGoogleCertificates() {
  const now = Date.now();
  if (googleCertificates && now < googleCertificatesExpiry) {
    return googleCertificates;
  }

  return new Promise((resolve, reject) => {
    https.get('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', (res) => {
      let data = '';
      
      // Ler cabeçalho de cache-control para expiração
      const cacheControl = res.headers['cache-control'] || '';
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
      googleCertificatesExpiry = Date.now() + maxAge * 1000;

      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          googleCertificates = JSON.parse(data);
          resolve(googleCertificates);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function verifyFirebaseToken(token, projectId) {
  return new Promise(async (resolve) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return resolve({ valid: false, error: 'Token malformatado' });

      const [headerB64, payloadB64, signatureB64] = parts;
      
      // Decodificar cabeçalho para pegar a chave kid
      const headerJson = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));
      const kid = headerJson.kid;
      if (!kid) return resolve({ valid: false, error: 'Header do JWT sem kid' });

      // Decodificar payload para verificar claims
      const payloadJson = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
      
      const now = Math.floor(Date.now() / 1000);
      if (payloadJson.exp < now) return resolve({ valid: false, error: 'Token expirado' });
      if (payloadJson.aud !== projectId) return resolve({ valid: false, error: 'Audiência inválida' });
      if (payloadJson.iss !== `https://securetoken.google.com/${projectId}`) {
        return resolve({ valid: false, error: 'Emissor (issuer) inválido' });
      }

      // Buscar chaves públicas do Google e verificar assinatura criptográfica
      const certs = await getGoogleCertificates();
      const cert = certs[kid];
      if (!cert) return resolve({ valid: false, error: 'Chave pública não encontrada para o kid' });

      // Converter assinatura base64url para base64 padrão
      const signature = signatureB64.replace(/-/g, '+').replace(/_/g, '/');

      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${headerB64}.${payloadB64}`);
      
      const isSignatureValid = verifier.verify(cert, signature, 'base64');
      if (!isSignatureValid) return resolve({ valid: false, error: 'Assinatura criptográfica inválida' });

      resolve({ valid: true, decoded: payloadJson });
    } catch (e) {
      resolve({ valid: false, error: e.message || 'Falha ao processar token' });
    }
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar cabeçalho de autorização (Bearer token)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso negado. Token de autenticação ausente ou inválido.' });
  }

  const token = authHeader.split(' ')[1];
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    return res.status(500).json({ error: 'ID do projeto do Firebase não configurado no servidor Vercel.' });
  }

  const verification = await verifyFirebaseToken(token, projectId);
  if (!verification.valid) {
    return res.status(403).json({ error: `Acesso negado. Erro de autenticação: ${verification.error}` });
  }

  const { prompt, base64Image, mimeType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chave de API do Gemini não configurada no servidor Vercel.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let parts = [{ text: prompt }];
    if (base64Image && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Image
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }]
    });

    return res.status(200).json({ text: response.text });
  } catch (err) {
    console.error('Erro na Vercel Serverless Function:', err);
    return res.status(500).json({ error: err.message || 'Erro ao processar chamada do Gemini no servidor.' });
  }
};

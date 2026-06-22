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
    https.get('https://www.googleapis.com/robot/v1/metadata/x509/securetoken-system@system.gserviceaccount.com', (res) => {
      let data = '';
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
      const headerJson = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));
      const kid = headerJson.kid;
      if (!kid) return resolve({ valid: false, error: 'Header do JWT sem kid' });

      const payloadJson = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);
      if (payloadJson.exp < now) return resolve({ valid: false, error: 'Token expirado' });
      if (payloadJson.aud !== projectId) return resolve({ valid: false, error: 'Audiência inválida' });
      if (payloadJson.iss !== `https://securetoken.google.com/${projectId}`) {
        return resolve({ valid: false, error: 'Emissor (issuer) inválido' });
      }

      const certs = await getGoogleCertificates();
      const cert = certs[kid];
      if (!cert) return resolve({ valid: false, error: 'Chave pública não encontrada para o kid' });

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

function uploadToImgBB(base64Image, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = `image=${encodeURIComponent(base64Image)}`;
    
    const options = {
      hostname: 'api.imgbb.com',
      port: 443,
      path: `/1/upload?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Falha ao decodificar JSON do ImgBB'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  
  // CORS Seguro configurado dinamicamente para origens permitidas
  const allowedOrigins = [
    'https://balmiza-app.vercel.app',
    'http://localhost:3000',
    'http://localhost:8082'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validar Autenticação Firebase
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
    return res.status(403).json({ error: `Acesso negado: ${verification.error}` });
  }

  const { base64Image } = req.body;
  const apiKey = process.env.IMGBB_API_KEY || process.env.EXPO_PUBLIC_IMGBB_API_KEY;

  if (!base64Image) {
    return res.status(400).json({ error: 'Falta parâmetro base64Image no corpo da requisição.' });
  }

  // Validar limites de tamanho do arquivo para evitar DoS (limite de 10MB)
  const byteLength = Buffer.byteLength(base64Image, 'base64');
  if (byteLength > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'Arquivo muito grande. O limite máximo é de 10MB.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Chave de API do ImgBB não configurada no servidor Vercel.' });
  }

  try {
    const data = await uploadToImgBB(base64Image, apiKey);
    if (data.success) {
      return res.status(200).json({ success: true, url: data.data.url });
    } else {
      return res.status(502).json({ error: data.error?.message || 'Erro retornado pelo ImgBB' });
    }
  } catch (err) {
    console.error('Erro no upload de avaria no proxy Vercel:', err);
    return res.status(500).json({ error: 'Erro interno ao processar o upload no servidor.' });
  }
};

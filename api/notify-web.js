const webpush = require('web-push');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);

  const allowedOrigins = [
    'https://balmiza-app.vercel.app',
    'http://localhost:3000',
    'http://localhost:8082'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://balmiza-app.vercel.app');
  }

  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subscription, title, body, data } = req.body;

  if (!subscription || !title || !body) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: subscription, title, body.' });
  }

  // Chaves VAPID configuradas nas variáveis de ambiente
  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublicKey || !vapidPrivateKey) {
    return res.status(500).json({ error: 'VAPID keys não configuradas no servidor.' });
  }

  webpush.setVapidDetails(
    'mailto:contato@balmiza.com.br',
    vapidPublicKey,
    vapidPrivateKey
  );

  try {
    const payload = JSON.stringify({
      title,
      body,
      data: data || {}
    });

    await webpush.sendNotification(subscription, payload);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar web push:', err);
    // Se o endpoint expirou ou foi cancelado pelo navegador
    if (err.statusCode === 410 || err.statusCode === 404) {
      return res.status(410).json({ error: 'Inscrição expirada ou cancelada.', expired: true });
    }
    return res.status(500).json({ error: 'Erro ao enviar notificação.', details: err.message });
  }
};

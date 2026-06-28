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

  const { token, title, body, data } = req.body;

  if (!token || !title || !body) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: token, title, body.' });
  }

  // Validar formato do token Expo
  if (!token.startsWith('ExponentPushToken')) {
    return res.status(400).json({ error: 'Token de push inválido.' });
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: 'high',
        channelId: 'balmiza-default',
      }),
    });

    const result = await response.json();

    if (result.data && result.data.status === 'error') {
      console.error('Expo Push Error:', result.data.message);
      return res.status(400).json({ error: result.data.message });
    }

    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Erro ao enviar notificação push:', err);
    return res.status(500).json({ error: 'Erro interno ao enviar notificação.' });
  }
};

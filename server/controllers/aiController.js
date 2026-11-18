// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — AI Photorealistic Rendering Controller
// Proxies OpenAI DALL-E 3 / GPT-4o Vision API requests seamlessly
// ═══════════════════════════════════════════════════════════════════════════════

const https = require('https');

exports.getAIKey = (req, res) => {
  const configuredKey = process.env.OPENAI_API_KEY || '';
  res.json({
    configured: !!configuredKey,
    keyMasked: configuredKey ? configuredKey.slice(0, 7) + '...' + configuredKey.slice(-4) : '',
    hasKey: !!configuredKey
  });
};

exports.getAIConfig = (req, res) => {
  const configuredKey = process.env.OPENAI_API_KEY || '';
  res.json({
    configured: !!configuredKey,
    keyMasked: configuredKey ? configuredKey.slice(0, 7) + '...' + configuredKey.slice(-4) : '',
    hasKey: !!configuredKey
  });
};

exports.renderAI = async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY || (req.body && typeof req.body.apiKey === 'string' ? req.body.apiKey.trim() : '');
    const prompt = (req.body && req.body.prompt) || 'Luxury architectural interior photograph';

    if (!apiKey) {
      return res.status(400).json({ error: { message: 'OpenAI API key is not configured on the server or provided in request.' } });
    }

    const payload = JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 1000),
      n: 1,
      size: '1792x1024',
      quality: 'hd',
      style: 'natural'
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          res.status(apiRes.statusCode).json(parsed);
        } catch (e) {
          res.status(apiRes.statusCode).send(data);
        }
      });
    });

    apiReq.on('error', (err) => {
      res.status(500).json({ error: { message: err.message } });
    });

    apiReq.write(payload);
    apiReq.end();
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
};

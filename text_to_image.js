// Serverless: POST /api/runway/text_to_image
// Creates an image from text and returns its URL

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

function inferRatio(input = '') {
  const s = String(input).toLowerCase();
  const allowed = new Set(['720:1280','1080:1920','1280:720','1920:1080','1024:1024','1080:1080']);
  if (s.includes('9:16') || s.includes('reel') || s.includes('story') || s.includes('portrait')) return '720:1280';
  if (s.includes('16:9') || s.includes('landscape') || s.includes('youtube') || s.includes('tiktok')) return '1280:720';
  if (s.includes('1:1') || s.includes('square')) return '1024:1024';
  const m = s.match(/(\d{3,4})\s*[:x]\s*(\d{3,4})/);
  if (m) {
    const val = `${m[1]}:${m[2]}`;
    if (allowed.has(val)) return val;
  }
  return '720:1280';
}

module.exports = async (req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
    if (!RUNWAY_API_KEY) return res.status(500).send('Missing RUNWAY_API_KEY');

    const body = parseBody(req);
    const promptText = body.promptText || body.prompt || '';
    if (!promptText) return res.status(400).send('Missing promptText');

    const ratio = inferRatio(body.ratio || body.aspect || '');

    const r = await fetch('https://api.dev.runwayml.com/v1/text_to_image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        model: 'gen4_image',
        promptText,
        ratio
      })
    });

    if (!r.ok) return res.status(r.status).send(await r.text());
    const start = await r.json();

    // Poll for completion
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let tries = 0;
    while (tries < 36) {
      const pr = await fetch(`https://api.dev.runwayml.com/v1/tasks/${start.id}`, {
        headers: {
          'Authorization': `Bearer ${RUNWAY_API_KEY}`,
          'X-Runway-Version': '2024-11-06'
        }
      });
      if (!pr.ok) return res.status(pr.status).send(await pr.text());
      const task = await pr.json();
      if (task.status === 'SUCCEEDED' && task.output?.length) {
        return res.json({ imageUrl: task.output[0], taskId: start.id, status: task.status });
      }
      if (['FAILED','CANCELED'].includes(task.status)) {
        return res.status(500).send(task.status);
      }
      await wait(5000 + Math.floor(Math.random() * 800));
      tries++;
    }
    return res.status(504).send('Timeout waiting for text_to_image');
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message || 'Server error');
  }
};

// Serverless: POST /api/runway/image_to_video
// Starts an image_to_video task. If no image is supplied, we seed with text_to_image.
// Any Gen-3 UI choice is mapped to Gen-4 Turbo.
// HARD GUARANTEE: ratio is forced to a Runway-accepted value.

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

// Allowed by Runway as of 2024-11-06 (list mirrors their error payload)
const ALLOWED = new Set([
  '1024:1024','1080:1080','1168:880','1360:768','1440:1080','1080:1440','1808:768',
  '1920:1080','1080:1920','2112:912','1280:720','720:1280','720:720','960:720',
  '720:960','1680:720'
]);

function cleanRatio(input = '') {
  const s = String(input).trim().toLowerCase();

  // Friendly labels from UI
  if (s.includes('9:16') || s.includes('reel') || s.includes('story') || s.includes('portrait')) return '720:1280';
  if (s.includes('16:9') || s.includes('landscape') || s.includes('youtube') || s.includes('tiktok')) return '1280:720';
  if (s.includes('1:1') || s.includes('square')) return '1024:1024';

  // "WxH" or "W:H" formats
  const m = s.match(/(\d{3,4})\s*[:x]\s*(\d{3,4})/);
  if (m) {
    const val = `${m[1]}:${m[2]}`;
    if (ALLOWED.has(val)) return val;
  }
  // FINAL GUARANTEE: vertical default
  return '720:1280';
}

function normalizeModel(raw = '') {
  const s = String(raw).toLowerCase();
  if (s.includes('gen4')) return 'gen4_turbo';
  if (s.includes('gen3')) return 'gen4_turbo';
  return 'gen4_turbo';
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
    const requested = body.ratio || body.aspect || '';
    let ratio = cleanRatio(requested);

    // If somehow still not allowed (whitespace, weird chars), force it:
    if (!ALLOWED.has(ratio)) ratio = '720:1280';

    const model = normalizeModel(body.model);
    const duration = Number(body.duration) > 0 ? Math.min(Number(body.duration), 10) : 5;

    let promptImage = body.promptImage; // URL (optional)

    // If no image provided, create a seed image from text first
    if (!promptImage) {
      if (!promptText) return res.status(400).send('Provide promptText or promptImage');

      const r0 = await fetch('https://api.dev.runwayml.com/v1/text_to_image', {
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
      if (!r0.ok) return res.status(r0.status).send(await r0.text());
      const start0 = await r0.json();

      // Poll the seed image
      const wait = ms => new Promise(r => setTimeout(r, ms));
      for (let tries = 0; tries < 36; tries++) {
        const pr = await fetch(`https://api.dev.runwayml.com/v1/tasks/${start0.id}`, {
          headers: {
            'Authorization': `Bearer ${RUNWAY_API_KEY}`,
            'X-Runway-Version': '2024-11-06'
          }
        });
        if (!pr.ok) return res.status(pr.status).send(await pr.text());
        const task = await pr.json();
        if (task.status === 'SUCCEEDED' && task.output?.length) {
          promptImage = task.output[0];
          break;
        }
        if (['FAILED', 'CANCELED'].includes(task.status)) {
          return res.status(500).send('text_to_image failed');
        }
        await wait(5000 + Math.floor(Math.random() * 800));
      }
      if (!promptImage) return res.status(504).send('Timeout waiting for seed image');
    }

    // Start image_to_video
    const r = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        model,
        promptImage,
        promptText,
        ratio,          // <- guaranteed valid now
        duration
      })
    });

    if (!r.ok) return res.status(r.status).send(await r.text());
    const start = await r.json();
    return res.json({ taskId: start.id });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message || 'Server error');
  }
};

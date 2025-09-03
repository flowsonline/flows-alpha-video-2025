module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const { text, voice } = req.body || {};
    if (!text) return res.status(400).send('Missing text');
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

    // OpenAI TTS: returns audio as base64
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: text,
        voice: voice || process.env.OPENAI_TTS_VOICE || 'alloy',
        format: 'mp3'
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).send(t);
    }
    const b = await r.arrayBuffer();
    const base64 = Buffer.from(b).toString('base64');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json({ base64, mime: 'audio/mpeg' });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message || 'Server error');
  }
};

const { TextDecoder } = require('util');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).send('Missing prompt');
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a concise performance ad copywriter.'},
          { role: 'user', content: prompt }
        ],
        temperature: 0.8
      })
    });

    if(!r.ok){
      const t = await r.text();
      return res.status(r.status).send(t);
    }
    const j = await r.json();
    const script = j.choices?.[0]?.message?.content?.trim() || '';
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.json({ script });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message || 'Server error');
  }
};

// Serverless: GET /api/runway/task?id=...

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
    if (!RUNWAY_API_KEY) return res.status(500).send('Missing RUNWAY_API_KEY');

    const id = (req.query && (req.query.id || req.query.taskId)) || null;
    if (!id) return res.status(400).send('Missing id');

    const r = await fetch(`https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(id)}`, {
      headers: {
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'X-Runway-Version': '2024-11-06'
      }
    });

    if (!r.ok) return res.status(r.status).send(await r.text());
    const j = await r.json();
    return res.json({ status: j.status, output: j.output || [], raw: j });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message || 'Server error');
  }
};

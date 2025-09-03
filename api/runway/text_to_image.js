function setCORS(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { setCORS(res); return res.status(200).end(); }
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
    if (!RUNWAY_API_KEY) throw new Error('Missing RUNWAY_API_KEY');
    const body = req.body || {};
    const promptText = body.promptText || body.prompt || '';
    if(!promptText) return res.status(400).send('Missing promptText');
    let ratio = body.ratio || '768:1280';
    if (ratio === '1080:1080') ratio = '1024:1024';

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
    if(!r.ok) { const t = await r.text(); return res.status(r.status).send(t); }
    const start = await r.json();
    const id = start.id;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let tries = 0; let task;
    while(tries < 36) {
      const pr = await fetch(`https://api.dev.runwayml.com/v1/tasks/${id}`, {
        headers: { 'Authorization': `Bearer ${RUNWAY_API_KEY}`, 'X-Runway-Version': '2024-11-06' }
      });
      if(!pr.ok) { const tt = await pr.text(); return res.status(pr.status).send(tt); }
      task = await pr.json();
      if(task.status === 'SUCCEEDED' && task.output && task.output.length) {
        setCORS(res);
        return res.json({ imageUrl: task.output[0], taskId: id, status: task.status });
      }
      if(['FAILED','CANCELED'].includes(task.status)) return res.status(500).send(task.status);
      await wait(5000 + Math.floor(Math.random()*1000));
      tries++;
    }
    return res.status(504).send('Timeout waiting for text_to_image');
  } catch(e) {
    console.error(e);
    return res.status(500).send(e.message || 'Server error');
  }
};

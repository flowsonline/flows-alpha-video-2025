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
    const promptImage = body.promptImage;
    const promptText = body.promptText || '';
    let ratio = body.ratio || '768:1280';
    if (!['768:1280','1280:720','1280:768','1024:1024'].includes(ratio)) ratio = '768:1280';

    // Map UI selections to valid model IDs
    const rawModel = (body.model || '').toString().toLowerCase();
    let model = 'gen4_turbo';
    if (rawModel.includes('gen4')) model = 'gen4_turbo'; // normalize all gen4 variants to turbo
    if (rawModel.includes('gen3')) model = 'gen4_turbo'; // force upgrade (gen3 not available on this API)

    const duration = typeof body.duration === 'number' ? body.duration : 5;

    if(!promptImage && !promptText) return res.status(400).send('Provide promptImage or promptText');

    // If only text provided, auto-generate a seed image first
    let image = promptImage;
    if(!image) {
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
          ratio: ratio === '1280:720' ? '1280:720' : (ratio === '1024:1024' ? '1024:1024' : '768:1280')
        })
      });
      if(!r0.ok) { const t0 = await r0.text(); return res.status(r0.status).send(t0); }
      const start0 = await r0.json();
      const id0 = start0.id;
      const wait = ms => new Promise(r => setTimeout(r, ms));
      let tries = 0; let task0;
      while(tries < 36) {
        const pr0 = await fetch(`https://api.dev.runwayml.com/v1/tasks/${id0}`, {
          headers: { 'Authorization': `Bearer ${RUNWAY_API_KEY}`, 'X-Runway-Version': '2024-11-06' }
        });
        if(!pr0.ok) { const tt0 = await pr0.text(); return res.status(pr0.status).send(tt0); }
        task0 = await pr0.json();
        if(task0.status === 'SUCCEEDED' && task0.output && task0.output.length) { image = task0.output[0]; break; }
        if(['FAILED','CANCELED'].includes(task0.status)) return res.status(500).send('text_to_image failed');
        await wait(5000 + Math.floor(Math.random()*1000));
        tries++;
      }
      if(!image) return res.status(504).send('Timeout waiting for seed image');
    }

    const r = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify({
        model,
        promptImage: image,
        promptText,
        ratio,
        duration
      })
    });
    if(!r.ok) { const t = await r.text(); return res.status(r.status).send(t); }
    const start = await r.json();
    setCORS(res);
    return res.json({ taskId: start.id });
  } catch(e) {
    console.error(e);
    return res.status(500).send(e.message || 'Server error');
  }
};

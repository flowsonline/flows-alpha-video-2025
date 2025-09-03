
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return res.status(500).send('Missing BLOB_READ_WRITE_TOKEN');
    const url = new URL(req.url, 'https://dummy');
    const filename = url.searchParams.get('filename') || `upload-${Date.now()}`;
    const contentType = url.searchParams.get('contentType') || 'application/octet-stream';
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const r = await fetch('https://blob.vercel-storage.com/' + encodeURIComponent(filename), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'X-Blob-Content-Type': contentType,
        'X-Blob-Cache-Control': 'public, max-age=31536000, immutable'
      },
      body: buffer
    });
    if (!r.ok) { const t = await r.text(); return res.status(r.status).send(t); }
    const j = await r.json();
    return res.json({ url: j.url });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.message || 'Upload failed');
  }
};

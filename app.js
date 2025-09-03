(() => {
  const $ = s => document.querySelector(s);

  // Elements (match your HTML IDs)
  const el = {
    product: $('#product'),
    audience: $('#audience'),
    goal: $('#goal'),
    tone: $('#tone'),
    visual: $('#visual'),
    cta: $('#cta'),

    ratio: $('#ratio'),
    duration: $('#duration'),
    model: $('#model'),
    refimg: $('#refimg'),

    uploadBtn: $('#uploadBtn'),
    uploadStatus: $('#uploadStatus'),

    btnScript: $('#btnScript'),
    btnTTS: $('#btnTTS'),
    btnVideo: $('#btnVideo'),

    preview: $('#preview'),
    script: $('#script'),
    voice: $('#voice'),
    dlAudio: $('#dlAudio'),
    audio: $('#audio'),

    video: $('#video'),
    status: $('#status')
  };

  // ————— Helpers —————
  const setStatus = msg => { if (el.status) el.status.textContent = msg || ''; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Default to Gen-4 Turbo; (we also removed Gen-3 from the HTML)
  document.addEventListener('DOMContentLoaded', () => {
    if (el.model) el.model.value = 'gen4_turbo';
  });

  // Build a quick ad script from the form
  function buildScript() {
    const p = (el.product?.value || '').trim();
    const a = (el.audience?.value || '').trim();
    const tone = (el.tone?.value || '').trim();
    const vnotes = (el.visual?.value || '').trim();
    const goal = (el.goal?.value || '').trim();
    const cta = (el.cta?.value || 'Shop now!').trim();

    const lines = [
      p ? p : 'Amazing product for your day.',
      a ? `Made for ${a}.` : '',
      vnotes ? vnotes : '',
      goal ? goal : '',
      cta
    ].filter(Boolean);

    return lines.join('\n');
  }

  // 1) Generate Script
  el.btnScript?.addEventListener('click', () => {
    const s = buildScript();
    if (el.script) el.script.value = s;
    if (el.preview) el.preview.value = s;
    if (el.btnTTS) el.btnTTS.disabled = false;
    if (el.btnVideo) el.btnVideo.disabled = false;
    setStatus('Script ready.');
  });

  // 2) Make Voiceover (MP3)
  el.btnTTS?.addEventListener('click', async () => {
    try {
      setStatus('Generating voiceover…');
      const text = el.script?.value || buildScript();
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: el.voice?.value || 'alloy' })
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      if (el.audio) {
        el.audio.src = url;
        el.audio.style.display = 'block';
      }
      if (el.dlAudio) {
        el.dlAudio.href = url;
        el.dlAudio.style.display = 'inline-block';
      }
      setStatus('Voiceover ready.');
    } catch (e) {
      console.error(e);
      setStatus('TTS failed: ' + e.message);
      alert('TTS failed: ' + e.message);
    }
  });

  // 2.5) Upload Image (optional)
  let uploadedImageUrl = '';
  el.uploadBtn?.addEventListener('click', async () => {
    try {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = async () => {
        const file = inp.files?.[0];
        if (!file) return;
        el.uploadStatus && (el.uploadStatus.textContent = 'Uploading…');
        const r = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || 'application/octet-stream')}`, {
          method: 'POST',
          body: file
        });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        uploadedImageUrl = j.url;
        el.uploadStatus && (el.uploadStatus.textContent = 'Image Ready ✓');
      };
      inp.click();
    } catch (e) {
      console.error(e);
      el.uploadStatus && (el.uploadStatus.textContent = 'Upload failed');
      alert('Upload failed: ' + e.message);
    }
  });

  // 3) Generate Video
  el.btnVideo?.addEventListener('click', async () => {
    try {
      setStatus('Starting video…');

      const promptText = el.script?.value || buildScript();
      const body = {
        promptText,
        ratio: el.ratio?.value || '720:1280',                       // Runway-approved sizes from HTML
        duration: (el.duration?.value || '5').toString(),
        model: el.model?.value || 'gen4_turbo'
      };

      // Prefer uploaded image, otherwise optional URL field
      if (uploadedImageUrl) body.promptImage = uploadedImageUrl;
      else if (el.refimg?.value) body.promptImage = el.refimg.value.trim();

      // Kick off video task
      const r = await fetch('/api/runway/image_to_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(await r.text());
      const { taskId } = await r.json();

      // Poll task
      let status = 'PENDING', output = [];
      for (let i = 0; i < 60; i++) {
        await sleep(4000 + Math.floor(Math.random() * 800));
        const pr = await fetch(`/api/runway/task?id=${encodeURIComponent(taskId)}`);
        const pj = await pr.json();
        status = pj.status;
        output = pj.output || [];
        setStatus(`Video status: ${status}`);
        if (status === 'SUCCEEDED' && output.length) break;
        if (status === 'FAILED' || status === 'CANCELED') break;
      }

      if (status === 'SUCCEEDED' && output.length) {
        const url = output[0];
        if (el.video) {
          el.video.src = url;
          el.video.style.display = 'block';
          el.video.play().catch(()=>{});
        }
        setStatus('Video ready ✓');
      } else {
        setStatus('Video failed: ' + status);
      }
    } catch (e) {
      console.error(e);
      setStatus('Video failed: ' + e.message);
      alert('Video failed: ' + e.message);
    }
  });
})();

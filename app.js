(() => {
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  // Elements (adjust selectors if your HTML differs)
  const el = {
    product: qs('#product'),
    audience: qs('#audience'),
    tone: qs('#tone'),
    notes: qs('#notes'),
    aspect: qs('#aspect'),            // e.g., "9:16 (Reel/Story)", "16:9 ..."
    duration: qs('#duration'),        // e.g., "5s"
    model: qs('#model'),              // dropdown with Gen-4 Turbo etc.
    cta: qs('#cta'),
    refUrl: qs('#refimg'),            // optional URL box in UI
    btnScript: qs('#btn-script'),
    btnTTS: qs('#btn-tts'),
    btnVideo: qs('#btn-video'),
    video: qs('#video'),
    scriptOut: qs('#script-out'),
    voice: qs('#voice'),

    // Upload helpers
    uploadWrap: qs('#upload-wrap'),
    uploadBtn: qs('#upload-btn'),
    uploadStatus: qs('#upload-status')
  };

  // Default to Gen-4 Turbo on load; optionally hide Gen-3 choices
  document.addEventListener('DOMContentLoaded', () => {
    if (el.model) {
      const optG4 = [...el.model.options].find(o =>
        /gen-?4/i.test(o.value) || /gen-?4/i.test(o.text)
      );
      if (optG4) el.model.value = optG4.value;

      // Optional: remove Gen-3 from view
      [...el.model.options].forEach(o => {
        if (/gen-?3/i.test(o.text) || /gen3/i.test(o.value)) o.remove();
      });
    }
  });

  // -------- Script generation (local, simple) ----------
  function buildAdScript() {
    const p = (el.product?.value || '').trim();
    const a = (el.audience?.value || '').trim();
    const t = (el.tone?.value || '').trim();
    const n = (el.notes?.value || '').trim();
    const cta = (el.cta?.value || '').trim() || 'Shop now!';
    return (
`Glow naturally with our vegan skincare.
Pure ingredients, no harmful chemicals.
Your skin deserves the best.
${cta}`
    );
  }

  el.btnScript?.addEventListener('click', () => {
    const s = buildAdScript();
    if (el.scriptOut) el.scriptOut.value = s;
  });

  // -------- TTS (your existing /api/tts) ----------
  el.btnTTS?.addEventListener('click', async () => {
    try {
      const text = el.scriptOut?.value || buildAdScript();
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: el.voice?.value || 'alloy' })
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = qs('#audio');
      if (audio) {
        audio.src = url;
        audio.play().catch(()=>{});
      }
    } catch (e) {
      console.error(e);
      alert('TTS failed: ' + e.message);
    }
  });

  // -------- Image Upload (Vercel Blob) ----------
  let uploadedImageUrl = '';
  el.uploadBtn?.addEventListener('click', async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        el.uploadStatus && (el.uploadStatus.textContent = 'Uploading...');
        const r = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || 'application/octet-stream')}`, {
          method: 'POST',
          body: file
        });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        uploadedImageUrl = j.url;
        el.uploadStatus && (el.uploadStatus.textContent = 'Image Ready ✓');
      };
      input.click();
    } catch (e) {
      console.error(e);
      el.uploadStatus && (el.uploadStatus.textContent = 'Upload failed');
      alert('Upload failed: ' + e.message);
    }
  });

  // -------- Generate Video ----------
  el.btnVideo?.addEventListener('click', async () => {
    try {
      const text = el.scriptOut?.value || buildAdScript();
      const body = {
        promptText: text,
        ratio: el.aspect?.value || el.aspect?.selectedOptions?.[0]?.text || '9:16',
        duration: (el.duration?.value || '5').toString().replace('s',''),
        model: el.model?.value || 'gen4_turbo'
      };
      if (uploadedImageUrl) body.promptImage = uploadedImageUrl;
      else if (el.refUrl?.value) body.promptImage = el.refUrl.value.trim(); // optional

      const r = await fetch('/api/runway/image_to_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(await r.text());
      const { taskId } = await r.json();

      // Poll task
      const wait = ms => new Promise(r => setTimeout(r, ms));
      let tries = 0, status = 'PENDING', out = [];
      while (tries < 60) {
        await wait(4000 + Math.floor(Math.random()*800));
        const pr = await fetch(`/api/runway/task?id=${encodeURIComponent(taskId)}`);
        const pj = await pr.json();
        status = pj.status;
        out = pj.output || [];
        if (status === 'SUCCEEDED' && out.length) break;
        if (['FAILED','CANCELED'].includes(status)) break;
        tries++;
      }

      if (status === 'SUCCEEDED' && out.length) {
        const v = qs('#video-player') || document.createElement('video');
        v.id = 'video-player';
        v.controls = true;
        v.autoplay = true;
        v.playsInline = true;
        v.src = out[0];
        el.video?.replaceChildren(v);
      } else {
        el.video && (el.video.textContent = `Video failed: ${status}`);
      }
    } catch (e) {
      console.error(e);
      el.video && (el.video.textContent = 'Video failed: ' + e.message);
    }
  });
})();

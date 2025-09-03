
async function postJSON(url, body){
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function getJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

const el = id => document.getElementById(id);
const product = el('product');
const audience = el('audience');
const goal = el('goal');
const tone = el('tone');
const visual = el('visual');
const cta = el('cta');
const ratio = el('ratio');
const duration = el('duration');
const model = el('model');
const refimg = el('refimg');

const btnScript = el('btnScript');
const btnTTS = el('btnTTS');
const btnVideo = el('btnVideo');

const preview = el('preview');
const scriptBox = el('script');
const voice = el('voice');
const audio = el('audio');
const dlAudio = el('dlAudio');
const video = el('video');
const status = el('status');

function buildPrompt(){
  const p = product.value.trim() || '(product?)';
  const a = audience.value.trim() || '(audience?)';
  const g = goal.value.trim() || '(goal?)';
  const t = tone.value.trim() || 'energetic, clean, high-contrast, fast cuts';
  const v = visual.value.trim() || '';
  const c = cta.value.trim() || 'Shop now';

  return `Create a ${duration.value}s vertical ad for ${p}. Audience: ${a}. Goal: ${g}.
Style: ${t}. Visual notes: ${v}. Include a clear on-screen call to action: "${c}". 
Use dynamic camera moves and product hero shots. Keep it brand-safe.`;
}

function buildScriptPrompt(){
  return `You are a performance ad copywriter. Write a ${duration.value}s voiceover script for a video ad.
Product/offer: ${product.value || '(not provided)'}
Audience: ${audience.value || '(not provided)'}
Goal: ${goal.value || '(not provided)'}
Tone: ${tone.value || 'energetic, clean'}
CTA: ${cta.value || 'Shop now'}

Requirements:
- 2–3 short punchy lines, total ${duration.value==='5'?'25-35':'45-65'} words max.
- Plain language, no jargon.
- End with the CTA verbatim.
Return only the script text.`;
}

function lockUI(locked){
  [btnScript, btnTTS, btnVideo].forEach(b=>b.disabled = locked);
}

function toast(msg){ status.textContent = msg; }

// Step 1: Generate Script
btnScript.addEventListener('click', async ()=>{
  try{
    lockUI(true);
    preview.value = buildPrompt() + "\n\n---\nVOICEOVER REQUEST\n" + buildScriptPrompt();
    toast("Generating script...");
    const data = await postJSON('/api/script', { prompt: buildScriptPrompt() });
    scriptBox.value = data.script;
    btnTTS.disabled = false;
    toast("Script ready.");
  }catch(e){
    console.error(e); toast("Script failed: " + e.message);
  }finally{ lockUI(false); }
});

// Step 2: TTS
btnTTS.addEventListener('click', async ()=>{
  try{
    lockUI(true);
    toast("Generating voiceover (MP3)...");
    const data = await postJSON('/api/tts', { text: scriptBox.value, voice: voice.value });
    const b64 = data.base64; const mime = data.mime || 'audio/mpeg';
    const src = `data:${mime};base64,${b64}`;
    audio.src = src; audio.style.display='block';
    dlAudio.href = src; dlAudio.style.display='inline-block';
    toast("Voiceover ready.");
  }catch(e){
    console.error(e); toast("TTS failed: " + e.message);
  }finally{ lockUI(false); }
});

// Step 3: Video (text->image->video)
btnVideo.addEventListener('click', async ()=>{
  try{
    lockUI(true);
    const promptText = buildPrompt();
    preview.value = promptText;

    // Use provided ref image or synthesize from text
    let promptImage = refimg.value.trim();
    if(!promptImage){
      toast("Generating first frame (image)...");
      const img = await postJSON('/api/runway/text_to_image', { promptText, ratio: ratio.value });
      promptImage = img.imageUrl;
    }

    toast("Starting video generation...");
    const start = await postJSON('/api/runway/image_to_video', {
      promptImage, promptText, ratio: ratio.value, duration: parseInt(duration.value,10), model: model.value
    });
    const taskId = start.taskId;
    toast("Rendering video… this can take 60–120s. Please keep this tab open.");

    // poll
    let done = false;
    while(!done){
      await new Promise(r=>setTimeout(r, 5000 + Math.random()*1000));
      const s = await getJSON('/api/runway/task?id=' + encodeURIComponent(taskId));
      if(s.status === 'SUCCEEDED' && s.output && s.output.length){
        video.src = s.output[0];
        video.style.display='block';
        toast("Video ready.");
        done = true;
      }else if(s.status === 'FAILED' || s.status === 'CANCELED'){
        throw new Error("Task " + s.status);
      }else{
        console.log("Status:", s.status);
      }
    }
  }catch(e){
    console.error(e); toast("Video failed: " + e.message);
  }finally{ lockUI(false); }
});

// Enable video button after any brief change (so user can run it directly)
[product,audience,goal,tone,visual,cta,ratio,duration,model,refimg].forEach(i=>{
  i.addEventListener('input', ()=>{ btnVideo.disabled = false; });
});

// init
btnVideo.disabled = false;

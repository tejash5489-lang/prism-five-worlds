/* ============================================================
   PRISM — shared synth audio bus. Mute-by-default; lazily creates
   an AudioContext on first user gesture (autoplay policy safe).
   ============================================================ */
(function(){
  let ctx = null;
  let master = null;
  let muted = true; // constraint: mute by default

  function ensureCtx(){
    if (ctx) return ctx;
    try{
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }catch(e){ /* no audio available, fail silent */ }
    return ctx;
  }

  function setMuted(v){
    muted = v;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, .02);
  }
  function isMuted(){ return muted; }
  function resume(){
    ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // simple tone blip: freq in Hz, dur in seconds, type oscillator shape
  function tone(freq, dur, opts){
    opts = opts || {};
    if (!ensureCtx()) return;
    resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1,opts.slideTo), t0 + dur);
    const peak = opts.gain != null ? opts.gain : 0.22;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(.02, dur*.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + dur + .02);
  }

  // short noise burst (for clicks / traces / collisions)
  function noise(dur, opts){
    opts = opts || {};
    if (!ensureCtx()) return;
    resume();
    const t0 = ctx.currentTime;
    const bufSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = opts.type || 'bandpass';
    filt.frequency.value = opts.freq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = opts.gain != null ? opts.gain : 0.25;
    src.connect(filt); filt.connect(gain); gain.connect(master);
    src.start(t0);
  }

  window.Audio2 = { ensureCtx, setMuted, isMuted, resume, tone, noise };
})();

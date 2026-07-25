/* ============================================================
   GLYPH HEIST — scan the grid, find the passcode, beat the trace.
   Click-to-peek. Every scan feeds the trace. No second tries.
   ============================================================ */
(function(){
  const { clamp, loop } = Utils;
  const GLYPHS = ['⌬','⏣','⌘','⎔','⟁','⧉','⨳','⟡','⬡','◈','⌁','✦','⎈','⏃','⟢','⧫','⌗','⏦','◬','⎋'];
  const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

  function shuffled(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  let root, wrap, stop, ro, audio;
  let cells = [];
  let target = [];
  let found = new Set();
  let trace = 0, traceRate = 2.2, scanPenalty = 5;
  let state = 'playing';
  let level = 1;
  let scans = 0;
  let elapsed = 0;
  let peekTimers = [];

  function buildLevel(){
    const letters = shuffled(POOL);
    cells = letters.map((ch, i) => ({
      i, letter: ch, glyph: GLYPHS[i % GLYPHS.length],
      state: 'hidden', // hidden | peek | wrong | right
    }));
    const codeLen = clamp(3 + level, 4, 6);
    const idxs = shuffled(cells.map(c=>c.i)).slice(0, codeLen);
    target = idxs.map(i => cells[i].letter).sort();
    found = new Set();
    trace = 0;
    traceRate = clamp(2.2 + (level-1)*0.35, 2.2, 4.2);
    scanPenalty = 5;
    scans = 0;
    elapsed = 0;
    state = 'playing';
    peekTimers.forEach(t => clearTimeout(t));
    peekTimers = [];
  }

  function renderPasscode(){
    const el = root.querySelector('.gh-slots');
    el.innerHTML = target.map(l => `<span class="gh-slot ${found.has(l)?'filled':''}">${found.has(l)?l:'?'}</span>`).join('');
  }

  function renderGrid(){
    const el = root.querySelector('.gh-grid');
    el.innerHTML = cells.map(c => {
      let cls = 'gh-cell ' + c.state;
      let content = '';
      if (c.state === 'peek' || c.state === 'right'){
        content = `<span class="gh-glyph">${c.glyph}</span><span class="gh-letter">${c.letter}</span>`;
      } else if (c.state === 'wrong'){
        content = `<span class="gh-glyph dim">${c.glyph}</span>`;
      } else {
        content = `<span class="gh-glyph dim">${c.glyph}</span>`;
      }
      return `<button class="${cls}" data-i="${c.i}" ${c.state==='wrong'||c.state==='right'?'disabled':''}>${content}</button>`;
    }).join('');
  }

  function scan(i, api){
    const c = cells[i];
    if (state !== 'playing' || c.state === 'wrong' || c.state === 'right' || c.state === 'peek') return;
    scans++;
    trace = clamp(trace + scanPenalty, 0, 100);
    if (target.includes(c.letter) && !found.has(c.letter)){
      c.state = 'right';
      found.add(c.letter);
      api.audio.tone(760, .22, { type:'sine', gain:.2, slideTo: 1100 });
      renderPasscode();
      if (found.size === target.length){ renderGrid(); updateTraceUI(); win(api); return; }
    } else {
      c.state = 'peek';
      api.audio.tone(220, .08, { type:'square', gain:.12 });
      const t = setTimeout(() => {
        if (c.state === 'peek') c.state = 'wrong';
        renderGrid();
      }, 750);
      peekTimers.push(t);
    }
    renderGrid();
    updateTraceUI();
  }

  function updateTraceUI(){
    const bar = root.querySelector('.gh-trace-fill');
    const pct = root.querySelector('.gh-trace-pct');
    bar.style.width = trace + '%';
    pct.textContent = Math.floor(trace) + '%';
    root.querySelector('.gh-trace').classList.toggle('danger', trace > 75);
  }

  function win(api){
    state = 'won';
    showOverlay('ACCESS GRANTED', `Passcode secured in ${elapsed.toFixed(1)}s with ${scans} scans.`, 'Next Heist ->');
    api.audio.tone(500,.15,{type:'sine',gain:.2,slideTo:700});
    setTimeout(()=>api.audio.tone(700,.15,{type:'sine',gain:.2,slideTo:1000}),140);
    setTimeout(()=>api.audio.tone(1000,.3,{type:'sine',gain:.2,slideTo:1300}),280);
  }
  function lose(api){
    state = 'lost';
    showOverlay('ALARM TRIGGERED', `The trace closed in at ${scans} scans. Try again.`, 'Retry');
    api.audio.noise(.6, { type:'lowpass', freq: 400, gain:.3 });
  }

  function showOverlay(title, sub, btnLabel){
    const ov = root.querySelector('.gh-overlay');
    ov.querySelector('.gh-ov-title').textContent = title;
    ov.querySelector('.gh-ov-sub').textContent = sub;
    ov.querySelector('.gh-ov-btn').textContent = btnLabel;
    ov.classList.add('show', state === 'won' ? 'won' : 'lost');
  }
  function hideOverlay(){
    const ov = root.querySelector('.gh-overlay');
    ov.classList.remove('show','won','lost');
  }

  function mount(container, api){
    root = container; audio = api.audio;
    root.innerHTML = `
      <div class="gh-wrap">
        <div class="gh-scan"></div>
        <div class="gh-top">
          <div class="gh-title">GLYPH HEIST <span class="gh-level">LV.1</span></div>
          <div class="gh-slots"></div>
        </div>
        <div class="gh-trace hud-panel">
          <span class="gh-trace-label">TRACE</span>
          <div class="gh-trace-track"><div class="gh-trace-fill"></div></div>
          <span class="gh-trace-pct">0%</span>
        </div>
        <div class="gh-grid"></div>
        <div class="gh-hint">Click cells to scan them. Every scan feeds the trace — find the passcode letters before it fills.</div>
        <div class="gh-overlay">
          <h2 class="gh-ov-title"></h2>
          <p class="gh-ov-sub"></p>
          <button class="hud-btn primary gh-ov-btn"></button>
        </div>
      </div>`;
    if (!document.getElementById('gh-style')){
      const style = document.createElement('style');
      style.id = 'gh-style';
      style.textContent = `
        .gh-wrap{ position:absolute; inset:0; background:#050807; overflow:hidden; display:flex; flex-direction:column; align-items:center;
          padding: 26px 20px 20px; font-family: 'Consolas','Segoe UI',monospace; }
        .gh-scan{ position:absolute; inset:0; pointer-events:none; opacity:.06;
          background: repeating-linear-gradient(0deg, #39ff88 0px, transparent 1px, transparent 3px); }
        .gh-top{ display:flex; flex-direction:column; align-items:center; gap:10px; z-index:2; }
        .gh-title{ color: var(--w-glyph); letter-spacing:.22em; font-size:14px; font-weight:700; text-shadow:0 0 12px rgba(57,255,136,.6); }
        .gh-level{ color:#8f8; opacity:.7; font-size:11px; margin-left:8px; }
        .gh-slots{ display:flex; gap:8px; }
        .gh-slot{ width:34px; height:40px; border:1px solid rgba(57,255,136,.35); border-radius:6px;
          display:flex; align-items:center; justify-content:center; font-size:18px; color:#3f5; background: rgba(57,255,136,.05); }
        .gh-slot.filled{ background: rgba(57,255,136,.22); color:#dfffe8; box-shadow:0 0 10px rgba(57,255,136,.5); }
        .gh-trace{ margin-top:14px; display:flex; align-items:center; gap:10px; padding:8px 16px; z-index:2; }
        .gh-trace-label{ font-size:11px; letter-spacing:.1em; color:#ff8a8a; }
        .gh-trace-track{ width:220px; height:9px; border-radius:5px; background:rgba(255,255,255,.08); overflow:hidden; }
        .gh-trace-fill{ height:100%; width:0%; background: linear-gradient(90deg,#ff5266,#ff2c4a); transition: width .15s linear; }
        .gh-trace.danger .gh-trace-fill{ animation: gh-pulse .5s infinite; }
        @keyframes gh-pulse{ 0%,100%{ filter:brightness(1);} 50%{ filter:brightness(1.6);} }
        .gh-trace-pct{ font-size:12px; color:#ffb; width:36px; }
        .gh-grid{ margin-top: 22px; display:grid; grid-template-columns: repeat(6, minmax(38px,54px)); gap:8px; z-index:2; }
        .gh-cell{ aspect-ratio:1; border-radius:8px; border:1px solid rgba(57,255,136,.25);
          background: rgba(20,30,24,.6); color:#7fdca0; cursor:pointer; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:1px; transition: background .15s, border-color .15s, transform .1s; }
        .gh-cell:hover:not(:disabled){ background: rgba(57,255,136,.14); transform: translateY(-1px); }
        .gh-cell .gh-glyph{ font-size:15px; }
        .gh-cell .gh-glyph.dim{ opacity:.45; }
        .gh-cell .gh-letter{ font-size:9px; opacity:.85; }
        .gh-cell.peek{ background: rgba(57,255,136,.28); border-color:#39ff88; }
        .gh-cell.wrong{ opacity:.35; cursor:default; }
        .gh-cell.right{ background: rgba(57,255,136,.35); border-color:#39ff88; box-shadow:0 0 12px rgba(57,255,136,.5); cursor:default; }
        .gh-hint{ margin-top:16px; font-size:11.5px; color:#6a9; opacity:.75; max-width:420px; text-align:center; z-index:2; }
        .gh-overlay{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:12px; background: rgba(3,5,4,.85); opacity:0; pointer-events:none; transition: opacity .3s; z-index:5; text-align:center; padding:0 20px; }
        .gh-overlay.show{ opacity:1; pointer-events:auto; }
        .gh-ov-title{ font-size: clamp(26px,4vw,42px); letter-spacing:.08em; }
        .gh-overlay.won .gh-ov-title{ color:#39ff88; text-shadow:0 0 20px rgba(57,255,136,.7); }
        .gh-overlay.lost .gh-ov-title{ color:#ff3b4e; text-shadow:0 0 20px rgba(255,59,78,.7); }
        .gh-ov-sub{ color:#bcd; font-size:14px; max-width:420px; }
        .gh-ov-btn{ margin-top:10px; padding:11px 22px; font-size:14px; }
      `;
      document.head.appendChild(style);
    }
    wrap = root.querySelector('.gh-wrap');

    buildLevel();
    renderGrid();
    renderPasscode();
    updateTraceUI();
    root.querySelector('.gh-level').textContent = 'LV.' + level;
    hideOverlay();

    root.querySelector('.gh-grid').addEventListener('click', e => {
      const btn = e.target.closest('.gh-cell');
      if (!btn) return;
      scan(+btn.dataset.i, api);
    });
    root.querySelector('.gh-ov-btn').addEventListener('click', () => {
      if (state === 'won') level++;
      buildLevel();
      renderGrid(); renderPasscode(); updateTraceUI(); hideOverlay();
      root.querySelector('.gh-level').textContent = 'LV.' + level;
    });

    stop = loop((dt) => {
      if (state !== 'playing') return;
      elapsed += dt;
      trace = clamp(trace + traceRate*dt, 0, 100);
      updateTraceUI();
      if (trace >= 100) lose(api);
    });
  }

  function unmount(){
    if (stop) stop();
    peekTimers.forEach(t => clearTimeout(t));
    peekTimers = [];
    root.innerHTML = '';
    root = wrap = stop = ro = null;
    level = 1; state = 'playing';
  }

  window.WORLDS = window.WORLDS || {};
  window.WORLDS.glyph = { mount, unmount };
})();

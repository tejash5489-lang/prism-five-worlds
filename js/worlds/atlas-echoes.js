/* ============================================================
   ATLAS OF ECHOES — an explorable constellation. Click a place
   to recover its echo. Recover them all and the map changes.
   ============================================================ */
(function(){
  const { clamp, loop, fitCanvas } = Utils;
  const STORE_KEY = 'prism-atlas-progress-v1';

  const NODES = [
    { id:0, x:.18, y:.30, name:'The Salt Library',        text:'A library the sea took gently, over centuries, one page at a time. What dissolved did not vanish — it crystallized in the salt, and divers still surface with grains that hum if you hold them to your ear.' },
    { id:1, x:.32, y:.62, name:'Nine Bells of Ashgrove',   text:'The village is gone, but the bells kept their tower. On the coldest nights they ring themselves — not a song, just the hour, faithfully, for no one.' },
    { id:2, x:.50, y:.20, name:'The Long Quiet',           text:'A relay station sent the same signal for forty years before it stopped. No one has found the cause of the silence. No one has found the cause of the forty years, either.' },
    { id:3, x:.64, y:.42, name:'Glass Orchard',            text:'Heat came fast enough to turn the fruit to glass mid-fall. The trees still hold their harvest, frozen an inch above the ground, catching the light exactly as it was that morning.' },
    { id:4, x:.46, y:.55, name:"The Cartographer's Debt",  text:'He only ever mapped the places he had already lost — a childhood house, a friend\'s handwriting, a coastline that moved. His atlas has no roads. Only distances.' },
    { id:5, x:.78, y:.28, name:'Harbor of Unsent Letters', text:'Every letter someone meant to send but didn\'t eventually finds its way here, folded into paper boats. The tide never takes them out. It only ever brings more in.' },
    { id:6, x:.82, y:.60, name:'The Sleeping Choir',       text:'Twelve statues stand in a ring, mouths open mid-note. Locals say they are still singing — just too slowly for anyone alive to hear the next word.' },
    { id:7, x:.60, y:.75, name:'Ember Meridian',           text:'An old survey line marks where, for one week each year, the sun is recorded setting twice. No instrument has ever caught it happening. Every instrument agrees that it did.' },
    { id:8, x:.28, y:.82, name:"The Last Garden's Keeper", text:'No one visits, but someone still prunes the hedges into shapes only visible from directly above — a message, maybe, to whatever still flies over.' },
  ];
  const EDGES = [[0,1],[1,4],[4,2],[2,3],[3,5],[5,6],[6,7],[7,4],[8,1],[8,7],[3,6]];

  let root, canvas, wrap, stop, ro, audio;
  let discovered = new Set();
  let hoverId = -1, mx=0, my=0;
  let panelOpenId = -1;
  let completedAt = 0;

  function loadProgress(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) discovered = new Set(JSON.parse(raw));
    }catch(e){ discovered = new Set(); }
  }
  function saveProgress(){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify([...discovered])); }catch(e){}
  }

  function nodePx(n, w, h){ return { x: n.x*w, y: n.y*h }; }

  function render(ctx, w, h, now){
    ctx.clearRect(0,0,w,h);
    const allDone = discovered.size === NODES.length;
    const bgShift = allDone ? clamp((now-completedAt)/2000,0,1) : 0;
    const bg = ctx.createRadialGradient(w*.5,h*.42,0,w*.5,h*.42,Math.max(w,h)*.75);
    bg.addColorStop(0, `rgba(${40+40*bgShift},${30+50*bgShift},${60+20*bgShift},1)`);
    bg.addColorStop(1, '#050609');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,w,h);

    // edges
    EDGES.forEach(([a,b]) => {
      const na = NODES[a], nb = NODES[b];
      const pa = nodePx(na,w,h), pb = nodePx(nb,w,h);
      const bothDone = discovered.has(a) && discovered.has(b);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
      if (bothDone){
        ctx.strokeStyle = `rgba(234,180,100,${.55 + .25*Math.sin(now*.002 + a)})`;
        ctx.lineWidth = 1.6;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,.08)';
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    });

    // nodes
    NODES.forEach(n => {
      const p = nodePx(n,w,h);
      const done = discovered.has(n.id);
      const hovered = hoverId === n.id;
      const pulse = .6 + .4*Math.sin(now*.003 + n.id);
      const r = done ? 6 + pulse*1.5 : 4.4;
      if (done){
        const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,26);
        g.addColorStop(0,'rgba(234,180,100,.5)');
        g.addColorStop(1,'rgba(234,180,100,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x,p.y,26,0,Math.PI*2); ctx.fill();
      }
      ctx.beginPath();
      ctx.fillStyle = done ? '#eab464' : (hovered ? '#fff' : 'rgba(255,255,255,.55)');
      ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fill();
      if (hovered || done){
        ctx.font = '600 12.5px Segoe UI, sans-serif';
        ctx.fillStyle = done ? '#f4dcae' : '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, p.x, p.y - r - 10);
        ctx.textAlign = 'left';
      }
    });
  }

  function pickNode(x,y,w,h){
    let best = -1, bd = 22*22;
    NODES.forEach(n => {
      const p = nodePx(n,w,h);
      const d2 = (p.x-x)**2 + (p.y-y)**2;
      if (d2 < bd){ bd = d2; best = n.id; }
    });
    return best;
  }

  function openPanel(id, api){
    panelOpenId = id;
    const panel = root.querySelector('.ae-panel');
    const n = NODES[id];
    const wasNew = !discovered.has(id);
    discovered.add(id);
    saveProgress();
    panel.classList.add('open');
    panel.querySelector('.ae-title').textContent = n.name;
    panel.querySelector('.ae-body').textContent = n.text;
    updateProgressLabel();
    if (wasNew) api.audio.tone(720, .5, { type:'sine', gain:.16, slideTo: 500 });
    if (discovered.size === NODES.length && completedAt === 0){
      completedAt = performance.now();
      setTimeout(() => root.querySelector('.ae-epilogue').classList.add('show'), 900);
      api.audio.tone(300,1.2,{type:'sine',gain:.2,slideTo:900});
    }
  }
  function closePanel(){
    panelOpenId = -1;
    root.querySelector('.ae-panel').classList.remove('open');
  }

  function updateProgressLabel(){
    root.querySelector('.ae-progress').textContent = `${discovered.size} / ${NODES.length} echoes recovered`;
  }

  function mount(container, api){
    root = container; audio = api.audio;
    root.innerHTML = `
      <div class="ae-wrap">
        <canvas class="ae-canvas"></canvas>
        <div class="ae-top hud-panel">
          <span class="ae-progress">0 / 9 echoes recovered</span>
        </div>
        <div class="ae-hint">Click a point of light to recover its echo</div>
        <aside class="ae-panel hud-panel">
          <button class="ae-close">&times;</button>
          <span class="ae-kicker">ECHO RECOVERED</span>
          <h3 class="ae-title"></h3>
          <p class="ae-body"></p>
        </aside>
        <div class="ae-epilogue">
          <h2>The Atlas is whole.</h2>
          <p>Nine echoes, one map. None of these places exist anymore — but you were here, and now the atlas remembers that too.</p>
        </div>
      </div>`;
    if (!document.getElementById('ae-style')){
      const style = document.createElement('style');
      style.id = 'ae-style';
      style.textContent = `
        .ae-wrap{ position:absolute; inset:0; background:#050609; overflow:hidden; }
        .ae-canvas{ position:absolute; inset:0; width:100%; height:100%; display:block; cursor:pointer; }
        .ae-top{ position:absolute; top:20px; left:20px; padding:10px 18px; font-size:13px; color:#f4dcae; letter-spacing:.04em; }
        .ae-hint{ position:absolute; bottom:18px; left:50%; transform:translateX(-50%);
          font-size:12px; color:#cbb; opacity:.65; pointer-events:none; }
        .ae-panel{ position:absolute; top:0; right:0; height:100%; width:340px;
          max-width:82vw; padding: 70px 30px 30px; transform: translateX(100%);
          transition: transform .38s cubic-bezier(.22,.9,.28,1); border-radius:0; border-left:1px solid rgba(255,255,255,.12); }
        .ae-panel.open{ transform: translateX(0); }
        .ae-close{ position:absolute; top:18px; right:18px; width:34px; height:34px; border-radius:50%;
          border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.05); color:#fff; font-size:18px; cursor:pointer; }
        .ae-kicker{ font-size:11px; letter-spacing:.16em; color: var(--w-atlas); }
        .ae-title{ font-size:22px; margin:10px 0 16px; color:#f6ecd6; }
        .ae-body{ font-size:14.5px; line-height:1.7; color:#cfc6b0; }
        .ae-epilogue{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
          text-align:center; background: rgba(5,4,8,.72); opacity:0; pointer-events:none; transition: opacity 1s ease; padding: 0 20px; }
        .ae-epilogue.show{ opacity:1; }
        .ae-epilogue h2{ font-size: clamp(24px,3.4vw,36px); color:#f4dcae; margin-bottom:14px; }
        .ae-epilogue p{ max-width:480px; color:#d8cdb2; font-size:15px; line-height:1.6; }
      `;
      document.head.appendChild(style);
    }

    wrap = root.querySelector('.ae-wrap');
    canvas = root.querySelector('.ae-canvas');
    fitCanvas(canvas, wrap);
    loadProgress();
    updateProgressLabel();
    if (discovered.size === NODES.length){
      completedAt = performance.now() - 3000;
      root.querySelector('.ae-epilogue').classList.add('show');
    }

    function onMove(e){
      const rect = canvas.getBoundingClientRect();
      mx = e.clientX-rect.left; my = e.clientY-rect.top;
      hoverId = pickNode(mx,my,wrap.clientWidth,wrap.clientHeight);
      canvas.style.cursor = hoverId>=0 ? 'pointer' : 'default';
    }
    function onClick(){
      if (hoverId >= 0) openPanel(hoverId, api);
    }
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);
    root.querySelector('.ae-close').addEventListener('click', closePanel);

    function onResize(){ fitCanvas(canvas, wrap); }
    window.addEventListener('resize', onResize);
    ro = onResize;

    stop = loop((dt, now) => {
      render(canvas.getContext('2d'), wrap.clientWidth, wrap.clientHeight, now);
    });

    mount._onMove = onMove; mount._onClick = onClick;
  }

  function unmount(){
    if (stop) stop();
    if (ro) window.removeEventListener('resize', ro);
    root.innerHTML = '';
    root = canvas = wrap = stop = ro = null;
    hoverId = -1; panelOpenId = -1; completedAt = 0;
  }

  window.WORLDS = window.WORLDS || {};
  window.WORLDS.atlas = { mount, unmount };
})();

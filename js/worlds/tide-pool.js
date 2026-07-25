/* ============================================================
   TIDE POOL LAB — a living agent-based ecosystem sim.
   Click to spawn life, tune sunlight & rain, watch it evolve.
   ============================================================ */
(function(){
  const { clamp, rand, randInt, loop, fitCanvas, dist2 } = Utils;

  const SPECIES = {
    algae:     { color:[110,230,140], baseR:3.2, metab:0.4,  reproE:16, reproCost:8,  gain:0,   sight:0,  speed:6,   cap:230 },
    grazer:    { color:[90,180,255],  baseR:4.2, metab:2.6,  reproE:26, reproCost:13, gain:15,  sight:90, speed:46,  cap:130 },
    predator:  { color:[255,120,90],  baseR:5.2, metab:3.4,  reproE:34, reproCost:17, gain:22,  sight:120,speed:58,  cap:55  },
  };
  const EAT = { grazer:'algae', predator:'grazer' };

  let root, canvas, wrap, stop, ro, audio;
  let orgs = [];
  let sunlight = 55, rainVal = 35;
  let spawnType = 'algae';
  let ripples = [];
  let history = []; // {t, algae, grazer, predator}
  let histTimer = 0;
  let dragging = false;
  let clockT = 0;

  function spawnAt(type, x, y, n){
    const cfg = SPECIES[type];
    const count = orgs.filter(o=>o.type===type).length;
    for (let i=0;i<n;i++){
      if (count+i >= cfg.cap) break;
      orgs.push({
        type, x: x+rand(-10,10), y: y+rand(-10,10),
        vx: rand(-10,10), vy: rand(-10,10),
        energy: rand(cfg.reproE*0.3, cfg.reproE*0.6),
        age: 0,
      });
    }
    ripples.push({ x, y, r: 4, a: .5 });
  }

  function buildGrid(cellSize, w, h){
    const grid = new Map();
    for (let i=0;i<orgs.length;i++){
      const o = orgs[i];
      const key = (Math.floor(o.x/cellSize)) + ',' + (Math.floor(o.y/cellSize));
      let arr = grid.get(key);
      if (!arr){ arr = []; grid.set(key, arr); }
      arr.push(i);
    }
    return grid;
  }
  function nearby(grid, cellSize, x, y, radius, cb){
    const cx = Math.floor(x/cellSize), cy = Math.floor(y/cellSize);
    const rc = Math.ceil(radius/cellSize);
    for (let gx=cx-rc; gx<=cx+rc; gx++){
      for (let gy=cy-rc; gy<=cy+rc; gy++){
        const arr = grid.get(gx+','+gy);
        if (arr) for (const idx of arr) cb(idx);
      }
    }
  }

  function update(dt, w, h){
    clockT += dt;
    // rain -> spontaneous algae spores
    const spawnChance = (rainVal/100) * 6 * dt;
    if (Math.random() < spawnChance && orgs.filter(o=>o.type==='algae').length < SPECIES.algae.cap){
      spawnAt('algae', rand(30,w-30), rand(30,h-30), 1);
    }

    const cellSize = 44;
    const grid = buildGrid(cellSize, w, h);
    const toAdd = [];
    const currentsSpeed = 1 + rainVal/100;
    const liveCounts = { algae:0, grazer:0, predator:0 };
    for (const o of orgs) if (!o.dead) liveCounts[o.type]++;

    for (let i=0;i<orgs.length;i++){
      const o = orgs[i];
      if (o.dead) continue;
      const cfg = SPECIES[o.type];
      o.age += dt;

      if (o.type === 'algae'){
        // crowding check
        let neigh = 0;
        nearby(grid, cellSize, o.x, o.y, 18, idx => { if (orgs[idx].type==='algae' && idx!==i) neigh++; });
        const crowd = clamp(1 - neigh/9, 0, 1);
        o.energy += cfg.metab * (sunlight/100) * crowd * dt * 3;
        o.vx += rand(-4,4)*dt; o.vy += rand(-4,4)*dt;
        o.vx *= 0.9; o.vy *= 0.9;
      } else {
        o.energy -= cfg.metab * dt;
        const preyType = EAT[o.type];
        let target = null, best = cfg.sight*cfg.sight;
        nearby(grid, cellSize, o.x, o.y, cfg.sight, idx => {
          const p = orgs[idx];
          if (p.type !== preyType || p.dead) return;
          const d2 = dist2(o.x,o.y,p.x,p.y);
          if (d2 < best){ best = d2; target = p; }
        });
        if (target){
          const dx = target.x-o.x, dy = target.y-o.y;
          const d = Math.sqrt(dx*dx+dy*dy) || 1;
          o.vx = (dx/d)*cfg.speed; o.vy = (dy/d)*cfg.speed;
          if (d < 9){
            target.dead = true;
            o.energy += cfg.gain;
          }
        } else {
          o.vx += rand(-30,30)*dt; o.vy += rand(-30,30)*dt;
          const sp = Math.sqrt(o.vx*o.vx+o.vy*o.vy);
          if (sp > cfg.speed) { o.vx = o.vx/sp*cfg.speed; o.vy = o.vy/sp*cfg.speed; }
        }
      }

      o.x += o.vx*dt*currentsSpeed;
      o.y += o.vy*dt*currentsSpeed;
      if (o.x < 6){ o.x = 6; o.vx *= -1; } if (o.x > w-6){ o.x = w-6; o.vx *= -1; }
      if (o.y < 6){ o.y = 6; o.vy *= -1; } if (o.y > h-6){ o.y = h-6; o.vy *= -1; }

      if (o.energy <= 0){
        o.dead = true;
        liveCounts[o.type]--;
      } else if (o.energy > cfg.reproE && orgs.length < 620 && liveCounts[o.type] < cfg.cap){
        o.energy -= cfg.reproCost;
        liveCounts[o.type]++;
        toAdd.push({ type:o.type, x:o.x+rand(-8,8), y:o.y+rand(-8,8), vx:rand(-10,10), vy:rand(-10,10), energy: cfg.reproCost*0.6, age:0 });
      }
    }
    if (orgs.length) orgs = orgs.filter(o => !o.dead);
    orgs = orgs.concat(toAdd);

    ripples.forEach(r => { r.r += 90*dt; r.a -= dt*0.9; });
    ripples = ripples.filter(r => r.a > 0);

    histTimer += dt;
    if (histTimer > 0.5){
      histTimer = 0;
      const counts = { algae:0, grazer:0, predator:0 };
      for (const o of orgs) counts[o.type]++;
      history.push(counts);
      if (history.length > 90) history.shift();
    }
  }

  function render(ctx, w, h){
    ctx.clearRect(0,0,w,h);
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'#03222a');
    g.addColorStop(1,'#011016');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

    ctx.save();
    ctx.globalAlpha = .08 + rainVal/100*0.06;
    ctx.strokeStyle = '#5fd0d8';
    for (let i=0;i<4;i++){
      ctx.beginPath();
      for (let x=0;x<=w;x+=20){
        const y = h*0.2 + i*h*0.2 + Math.sin(x*0.02 + clockT*1.2 + i)*10;
        if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    ctx.restore();

    for (const r of ripples){
      ctx.beginPath();
      ctx.strokeStyle = `rgba(180,240,255,${clamp(r.a,0,1)})`;
      ctx.lineWidth = 2;
      ctx.arc(r.x, r.y, r.r, 0, Math.PI*2);
      ctx.stroke();
    }

    for (const o of orgs){
      const cfg = SPECIES[o.type];
      const r = cfg.baseR + clamp(o.energy/cfg.reproE,0,1)*2.4;
      const grad = ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,r*2.6);
      grad.addColorStop(0, `rgba(${cfg.color[0]},${cfg.color[1]},${cfg.color[2]},.55)`);
      grad.addColorStop(1, `rgba(${cfg.color[0]},${cfg.color[1]},${cfg.color[2]},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(o.x,o.y,r*2.6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgb(${cfg.color[0]},${cfg.color[1]},${cfg.color[2]})`;
      ctx.beginPath(); ctx.arc(o.x,o.y,r,0,Math.PI*2); ctx.fill();
    }
  }

  function renderChart(canvas2){
    const ctx = canvas2.getContext('2d');
    const w = canvas2.width / (window.devicePixelRatio||1), h = canvas2.height / (window.devicePixelRatio||1);
    ctx.clearRect(0,0,w,h);
    if (history.length < 2) return;
    let max = 1;
    for (const rec of history) max = Math.max(max, rec.algae, rec.grazer, rec.predator);
    ['algae','grazer','predator'].forEach(key => {
      const cfg = SPECIES[key];
      ctx.beginPath();
      history.forEach((rec, i) => {
        const x = (i/(history.length-1)) * w;
        const y = h - (rec[key]/max) * (h-4) - 2;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.strokeStyle = `rgb(${cfg.color[0]},${cfg.color[1]},${cfg.color[2]})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    });
  }

  function counts(){
    const c = { algae:0, grazer:0, predator:0 };
    for (const o of orgs) c[o.type]++;
    return c;
  }

  function mount(container, api){
    root = container; audio = api.audio;
    root.innerHTML = `
      <div class="tp-wrap">
        <canvas class="tp-canvas"></canvas>
        <div class="tp-panel hud-panel">
          <div class="tp-row tp-types">
            <button class="hud-btn tp-type active" data-type="algae">Algae</button>
            <button class="hud-btn tp-type" data-type="grazer">Grazer</button>
            <button class="hud-btn tp-type" data-type="predator">Predator</button>
          </div>
          <label class="tp-slider">Sunlight <input type="range" id="tp-sun" min="0" max="100" value="55"></label>
          <label class="tp-slider">Rain <input type="range" id="tp-rain" min="0" max="100" value="35"></label>
          <button class="hud-btn" id="tp-clear">Clear pool</button>
        </div>
        <div class="tp-stats hud-panel">
          <div class="tp-stat-row"><span class="dot" style="background:rgb(110,230,140)"></span>Algae <b id="tp-c-algae">0</b></div>
          <div class="tp-stat-row"><span class="dot" style="background:rgb(90,180,255)"></span>Grazers <b id="tp-c-grazer">0</b></div>
          <div class="tp-stat-row"><span class="dot" style="background:rgb(255,120,90)"></span>Predators <b id="tp-c-predator">0</b></div>
          <div class="tp-stat-row diversity">Diversity: <b id="tp-diversity">0/3</b></div>
          <canvas class="tp-chart" width="220" height="60"></canvas>
        </div>
        <div class="tp-hint">Click or drag the water to spawn life</div>
      </div>`;
    if (!document.getElementById('tp-style')){
      const style = document.createElement('style');
      style.id = 'tp-style';
      style.textContent = `
        .tp-wrap{ position:absolute; inset:0; background:#011016; overflow:hidden; }
        .tp-canvas{ position:absolute; inset:0; width:100%; height:100%; display:block; cursor:pointer; }
        .tp-panel{ position:absolute; top:20px; left:20px; padding:14px; display:flex; flex-direction:column; gap:10px; width:200px; }
        .tp-row.tp-types{ display:flex; gap:6px; }
        .tp-type{ flex:1; padding:7px 6px; font-size:11.5px; }
        .tp-type.active{ background: rgba(47,224,173,.22); border-color: var(--w-tide); color:#daffee; }
        .tp-slider{ font-size:12px; color:#bcd; display:flex; flex-direction:column; gap:4px; }
        .tp-slider input{ width:100%; accent-color: var(--w-tide); }
        .tp-stats{ position:absolute; top:20px; right:20px; padding:14px; width:190px; display:flex; flex-direction:column; gap:6px; }
        .tp-stat-row{ font-size:12.5px; color:#cfe; display:flex; align-items:center; gap:8px; }
        .tp-stat-row .dot{ width:9px; height:9px; border-radius:50%; display:inline-block; }
        .tp-stat-row b{ margin-left:auto; }
        .tp-stat-row.diversity{ border-top:1px solid rgba(255,255,255,.1); padding-top:6px; margin-top:2px; }
        .tp-chart{ width:100%; height:60px; margin-top:4px; }
        .tp-hint{ position:absolute; bottom:16px; left:50%; transform:translateX(-50%);
          font-size:12px; color:#9fd; opacity:.7; pointer-events:none; }
      `;
      document.head.appendChild(style);
    }

    wrap = root.querySelector('.tp-wrap');
    canvas = root.querySelector('.tp-canvas');
    fitCanvas(canvas, wrap);
    const chartCanvas = root.querySelector('.tp-chart');
    chartCanvas.width = 220 * Math.min(window.devicePixelRatio||1,2);
    chartCanvas.height = 60 * Math.min(window.devicePixelRatio||1,2);
    chartCanvas.getContext('2d').setTransform(Math.min(window.devicePixelRatio||1,2),0,0,Math.min(window.devicePixelRatio||1,2),0,0);

    orgs = []; history = []; ripples = [];
    spawnAt('algae', wrap.clientWidth*0.5, wrap.clientHeight*0.5, 14);

    root.querySelectorAll('.tp-type').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.tp-type').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        spawnType = btn.dataset.type;
      });
    });
    const sunEl = root.querySelector('#tp-sun');
    const rainEl = root.querySelector('#tp-rain');
    sunEl.addEventListener('input', () => sunlight = +sunEl.value);
    rainEl.addEventListener('input', () => rainVal = +rainEl.value);
    root.querySelector('#tp-clear').addEventListener('click', () => { orgs = []; });

    function spawnFromEvent(e){
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX-rect.left, y = e.clientY-rect.top;
      spawnAt(spawnType, x, y, spawnType==='algae'?6:2);
      audio.tone(spawnType==='algae'?300:spawnType==='grazer'?420:180, .12, { type:'sine', gain:.14 });
    }
    canvas.addEventListener('mousedown', e => { dragging = true; spawnFromEvent(e); });
    function onMouseUp(){ dragging = false; }
    window.addEventListener('mouseup', onMouseUp);
    let lastDrag = 0;
    canvas.addEventListener('mousemove', e => {
      if (!dragging) return;
      const now = performance.now();
      if (now - lastDrag < 90) return;
      lastDrag = now;
      spawnFromEvent(e);
    });

    function onResize(){ fitCanvas(canvas, wrap); }
    window.addEventListener('resize', onResize);
    ro = onResize;

    const cAlgae = root.querySelector('#tp-c-algae');
    const cGrazer = root.querySelector('#tp-c-grazer');
    const cPred = root.querySelector('#tp-c-predator');
    const cDiv = root.querySelector('#tp-diversity');

    stop = loop((dt) => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      update(Math.min(dt,.033), w, h);
      const ctx = canvas.getContext('2d');
      render(ctx, w, h);
      renderChart(chartCanvas);
      const c = counts();
      cAlgae.textContent = c.algae; cGrazer.textContent = c.grazer; cPred.textContent = c.predator;
      const alive = (c.algae>0) + (c.grazer>0) + (c.predator>0);
      cDiv.textContent = alive + '/3';
    });

    mount._onMouseUp = onMouseUp;
  }

  function unmount(){
    if (stop) stop();
    if (ro) window.removeEventListener('resize', ro);
    if (mount._onMouseUp) window.removeEventListener('mouseup', mount._onMouseUp);
    root.innerHTML = '';
    root = canvas = wrap = stop = ro = null;
    orgs = []; history = []; ripples = []; dragging = false;
  }

  window.WORLDS = window.WORLDS || {};
  window.WORLDS.tide = { mount, unmount };
})();

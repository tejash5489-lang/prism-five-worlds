/* ============================================================
   ORIGIN SCROLL — a scroll-driven journey through cosmic time.
   cloud -> collapse -> ignition -> worlds -> us
   ============================================================ */
(function(){
  const { lerp, clamp, rand, smoothstep, loop, fitCanvas } = Utils;

  const STAGES = [
    { key:'cloud',    title:'A cloud, cooling in the dark',   body:'Hydrogen and dust, drifting for eons. Nothing here yet but potential.' },
    { key:'collapse', title:'Gravity wins',                    body:'The cloud folds in on itself. It spins faster as it shrinks.' },
    { key:'ignition', title:'A star lights up',                 body:'Pressure at the core ignites. Fusion begins. The dark has a center now.' },
    { key:'worlds',   title:'Worlds condense',                  body:'Leftover dust clumps into rock and ice. Orbits settle into place.' },
    { key:'us',       title:'Billions of years later — us',     body:'One small world, one thin layer of life, looking back up at the light.' },
  ];
  const N = STAGES.length;

  let root, canvas, scrollEl, stop, ro;
  let particles = [];
  let mx = 0, my = 0;
  let progress = 0;

  function initParticles(count){
    particles = [];
    for (let i = 0; i < count; i++){
      const depth = rand(.25, 1);
      particles.push({
        // stage 0: cloud — scattered normalized anchor
        cx: rand(0,1), cy: rand(0,1),
        // stage 1/2: disc / ignition — polar around center
        diskR: rand(.04, .34), diskA: rand(0, Math.PI*2), spin: rand(.15,.55) * (Math.random()<.5?-1:1),
        // stage 3: worlds — assign to one of 3 clusters
        cluster: i % 3,
        clusterA: rand(0, Math.PI*2),
        clusterLocal: rand(0, 1),
        // stage 4: us — a subset become "home" (cluster 0, close-in)
        home: (i % 3 === 0) && (i % 9 === 0),
        depth,
        r: rand(.6, 1.9) * (depth*.6+.5),
        tw: rand(0, Math.PI*2),
        twS: rand(.6, 1.6),
      });
    }
  }

  const CLUSTER_R = [.16, .26, .37];
  const CLUSTER_COLOR = [ [130,190,255], [255,210,140], [140,255,190] ];

  function stagePos(p, idx, w, h, t){
    const cx = w*0.5, cy = h*0.46;
    switch(idx){
      case 0: { // cloud
        return { x: p.cx*w, y: p.cy*h, col:[150,160,210], a: .55, r: p.r };
      }
      case 1: { // collapse -> disc
        const ang = p.diskA + t*p.spin*0.6;
        const rad = p.diskR * Math.min(w,h) * (1 - p.depth*0.15);
        return { x: cx + Math.cos(ang)*rad, y: cy + Math.sin(ang)*rad*0.55, col:[190,170,255], a:.75, r: p.r*1.1 };
      }
      case 2: { // ignition -> most pulled to core, some remain ring
        const core = p.depth > .45;
        if (core){
          const rad = p.diskR * Math.min(w,h) * 0.12;
          const ang = p.diskA + t*p.spin;
          return { x: cx + Math.cos(ang)*rad, y: cy + Math.sin(ang)*rad*0.6, col:[255,235,180], a:.95, r: p.r*1.6 };
        } else {
          const ang = p.diskA + t*p.spin*0.4;
          const rad = p.diskR * Math.min(w,h) * 0.5;
          return { x: cx + Math.cos(ang)*rad, y: cy + Math.sin(ang)*rad*0.55, col:[255,200,150], a:.5, r: p.r };
        }
      }
      case 3: { // worlds -> 3 clusters orbiting
        const baseR = CLUSTER_R[p.cluster] * Math.min(w,h);
        const ang = p.clusterA + t*(0.2 + p.cluster*0.08);
        const cxp = cx + Math.cos(ang)*baseR;
        const cyp = cy + Math.sin(ang)*baseR*0.55;
        const localRad = p.clusterLocal * 16 * p.depth;
        const lang = p.diskA + t*p.spin;
        const col = CLUSTER_COLOR[p.cluster];
        return { x: cxp + Math.cos(lang)*localRad, y: cyp + Math.sin(lang)*localRad, col, a:.85, r: p.r*1.2 };
      }
      case 4: { // us -> zoom toward home cluster (cluster 0)
        const baseR = CLUSTER_R[0] * Math.min(w,h);
        const ang = p.clusterA + t*0.2;
        const cxp = cx + Math.cos(ang)*baseR;
        const cyp = cy + Math.sin(ang)*baseR*0.55;
        if (p.cluster === 0){
          const localRad = p.clusterLocal * 16 * p.depth;
          const lang = p.diskA + t*p.spin;
          return { x: cxp + Math.cos(lang)*localRad, y: cyp + Math.sin(lang)*localRad, col:[150,255,200], a: p.home? 1:.7, r: p.home ? p.r*2.4 : p.r };
        } else {
          // fade other clusters far out
          const ang2 = p.clusterA + t*(0.2+p.cluster*0.08);
          const baseR2 = CLUSTER_R[p.cluster] * Math.min(w,h) * 1.6;
          return { x: cx + Math.cos(ang2)*baseR2, y: cy + Math.sin(ang2)*baseR2*0.55, col: CLUSTER_COLOR[p.cluster], a:.18, r: p.r*.7 };
        }
      }
    }
  }

  function render(ctx, w, h, now){
    ctx.clearRect(0,0,w,h);
    // deep space backdrop
    const bg = ctx.createLinearGradient(0,0,0,h);
    bg.addColorStop(0, '#04030a');
    bg.addColorStop(1, '#0a0714');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,w,h);

    const fp = progress * (N-1);
    const idx = clamp(Math.floor(fp), 0, N-2);
    const localT = smoothstep(0,1, fp - idx);
    const t = now*0.001;

    // central glow strength per stage
    const glowByStage = [.06, .18, 1, .55, .35];
    const glow = lerp(glowByStage[idx], glowByStage[idx+1], localT);
    const cx = w*0.5, cy = h*0.46;
    const g = ctx.createRadialGradient(cx,cy,0,cx,cy, Math.min(w,h)*0.5);
    g.addColorStop(0, `rgba(255,230,180,${0.5*glow})`);
    g.addColorStop(.4, `rgba(255,180,120,${0.22*glow})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    for (const p of particles){
      const a = stagePos(p, idx, w, h, t);
      const b = stagePos(p, idx+1, w, h, t);
      const x = lerp(a.x, b.x, localT) + mx * p.depth * 34;
      const y = lerp(a.y, b.y, localT) + my * p.depth * 24;
      const col = [0,1,2].map(i => lerp(a.col[i], b.col[i], localT));
      const alpha = lerp(a.a, b.a, localT) * (.7 + .3*Math.sin(t*p.twS + p.tw));
      const r = lerp(a.r, b.r, localT);
      ctx.beginPath();
      ctx.fillStyle = `rgba(${col[0]|0},${col[1]|0},${col[2]|0},${clamp(alpha,0,1)})`;
      ctx.arc(x, y, Math.max(.3,r), 0, Math.PI*2);
      ctx.fill();
    }
  }

  function updateCaptions(){
    const fp = progress * (N-1);
    root.querySelectorAll('.os-section').forEach((sec, i) => {
      const d = Math.abs(fp - i);
      const vis = clamp(1 - d*1.35, 0, 1);
      const txt = sec.querySelector('.os-text');
      txt.style.opacity = vis;
      txt.style.transform = `translateY(${(1-vis)*18}px)`;
    });
    const home = root.querySelector('.os-home-tag');
    if (home) home.style.opacity = clamp((fp - (N-1.4))*2.4, 0, 1);
  }

  function mount(container, api){
    root = container;
    root.innerHTML = `
      <div class="os-wrap">
        <canvas class="os-canvas"></canvas>
        <div class="os-vignette"></div>
        <div class="os-hint">Scroll to travel forward</div>
        <span class="os-home-tag">You are here</span>
        <div class="os-scroll">
          ${STAGES.map((s,i) => `
            <section class="os-section" data-i="${i}">
              <div class="os-text">
                <span class="os-kicker">0${i+1} / 0${N}</span>
                <h2>${s.title}</h2>
                <p>${s.body}</p>
              </div>
            </section>
          `).join('')}
        </div>
      </div>
    `;
    if (!document.getElementById('os-style')) {
      const style = document.createElement('style');
      style.id = 'os-style';
      style.textContent = `
        .os-wrap{ position:absolute; inset:0; overflow:hidden; background:#04030a; }
        .os-canvas{ position:absolute; inset:0; width:100%; height:100%; display:block; }
        .os-vignette{ position:absolute; inset:0; pointer-events:none;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,.55) 100%); }
        .os-scroll{ position:absolute; inset:0; overflow-y:auto; overflow-x:hidden; }
        .os-section{ height:100vh; display:flex; align-items:center; justify-content:flex-start; padding: 0 8vw; }
        .os-text{ max-width: 480px; opacity:0; transition: opacity .15s linear, transform .15s linear; }
        .os-kicker{ font-size:12px; letter-spacing:.16em; color: var(--w-origin); opacity:.8; }
        .os-text h2{ font-size: clamp(28px, 4vw, 46px); margin: 10px 0 14px; font-weight: 700; line-height:1.15; color:#f2eeff; }
        .os-text p{ font-size: 15px; line-height:1.6; color:#c7c3dd; margin:0; }
        .os-hint{ position:absolute; bottom:22px; left:50%; transform:translateX(-50%);
          font-size:12px; letter-spacing:.1em; color:#a79ee0; opacity:.75; pointer-events:none;
          animation: os-bob 2.4s ease-in-out infinite; }
        @keyframes os-bob{ 0%,100%{ transform:translate(-50%,0);} 50%{ transform:translate(-50%,6px);} }
        .os-home-tag{ position:absolute; top:44%; left:50%; transform:translate(-50%,-50%);
          font-size:13px; letter-spacing:.12em; color:#bff4d6; opacity:0; pointer-events:none;
          text-shadow: 0 0 12px rgba(140,255,190,.8); transition: opacity .3s; }
      `;
      document.head.appendChild(style);
    }

    canvas = root.querySelector('.os-canvas');
    scrollEl = root.querySelector('.os-scroll');
    const wrap = root.querySelector('.os-wrap');

    initParticles(520);
    fitCanvas(canvas, wrap);

    function onScroll(){
      const max = scrollEl.scrollHeight - scrollEl.clientHeight;
      progress = max > 0 ? clamp(scrollEl.scrollTop / max, 0, 1) : 0;
      updateCaptions();
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true });

    function onMove(e){
      const rect = wrap.getBoundingClientRect();
      mx = ((e.clientX - rect.left) / rect.width - .5) * 2;
      my = ((e.clientY - rect.top) / rect.height - .5) * 2;
    }
    wrap.addEventListener('mousemove', onMove);

    function onResize(){ fitCanvas(canvas, wrap); }
    window.addEventListener('resize', onResize);
    ro = onResize;

    onScroll();
    stop = loop((dt, now) => {
      const ctx = canvas.getContext('2d');
      const w = wrap.clientWidth, h = wrap.clientHeight;
      render(ctx, w, h, now);
    });

    mount._onMove = onMove; mount._onScroll = onScroll; mount._wrap = wrap;
  }

  function unmount(){
    if (stop) stop();
    if (ro) window.removeEventListener('resize', ro);
    if (mount._wrap && mount._onMove) mount._wrap.removeEventListener('mousemove', mount._onMove);
    if (scrollEl && mount._onScroll) scrollEl.removeEventListener('scroll', mount._onScroll);
    root.innerHTML = '';
    root = canvas = scrollEl = stop = ro = null;
    progress = 0;
  }

  window.WORLDS = window.WORLDS || {};
  window.WORLDS.origin = { mount, unmount };
})();

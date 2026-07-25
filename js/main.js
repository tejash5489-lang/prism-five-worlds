/* ============================================================
   PRISM — hub, router, background, bootstrapping
   ============================================================ */
(function(){

  const ICONS = {
    origin: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="16" cy="16" r="2.2" fill="currentColor" stroke="none"/><path d="M16 4c-3 3-3 7 0 8s3 5 0 8-3 7 0 8" opacity=".9"/><path d="M27 12c-4-1.5-7 0-7 3s3 3 7 1.5" opacity=".6"/><path d="M5 20c4 1.5 7 0 7-3s-3-3-7-1.5" opacity=".6"/></svg>',
    bike: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="23" r="5"/><circle cx="24" cy="23" r="5"/><path d="M8 23l6-13h5l5 13"/><path d="M14 10h5"/><path d="M13 23h11"/><circle cx="13" cy="8" r="1.6" fill="currentColor" stroke="none"/></svg>',
    tide: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M16 5c4 6 8 10 8 15a8 8 0 0 1-16 0c0-5 4-9 8-15z"/><path d="M12 22c1 1.5 2.5 2 4 2s3-.5 4-2" opacity=".7"/></svg>',
    atlas: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="16" cy="16" r="11"/><path d="M20 12l-3 5-5 3 3-5 5-3z" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1" fill="currentColor" stroke="none"/></svg>',
    glyph: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="14" width="14" height="12" rx="2"/><path d="M12 14v-3a4 4 0 0 1 8 0v3"/><circle cx="16" cy="19" r="1.4" fill="currentColor" stroke="none"/><path d="M16 20.4v2.2"/></svg>'
  };

  const WORLD_META = [
    { id: 'origin', name: 'Origin Scroll', pitch: 'A tiny film: scroll from cloud to collapse to light — to us.', accent: 'var(--w-origin)', icon: ICONS.origin },
    { id: 'bike',   name: 'Open Bike City', pitch: 'Ride an open city block. Boost, jump ramps, chase every coin.', accent: 'var(--w-bike)', icon: ICONS.bike },
    { id: 'tide',   name: 'Tide Pool Lab', pitch: 'Touch water to spawn life. Tune sun and rain. Watch it evolve.', accent: 'var(--w-tide)', icon: ICONS.tide },
    { id: 'atlas',  name: 'Atlas of Echoes', pitch: 'A constellation of lost places. Click to recover their echoes.', accent: 'var(--w-atlas)', icon: ICONS.atlas },
    { id: 'glyph',  name: 'Glyph Heist', pitch: 'Scan the grid, find the passcode, beat the trace. No second tries.', accent: 'var(--w-glyph)', icon: ICONS.glyph },
  ];

  const hub = document.getElementById('hub');
  const stage = document.getElementById('world-stage');
  const mount = document.getElementById('world-mount');
  const veil = document.getElementById('transition-veil');
  const cardGrid = document.getElementById('card-grid');
  const backBtn = document.getElementById('back-to-hub');
  const muteBtn = document.getElementById('mute-toggle');

  let current = null; // active world instance {id, mod}
  let switching = false;

  // ---------- build cards ----------
  WORLD_META.forEach((w, i) => {
    const card = document.createElement('button');
    card.className = 'world-card';
    card.style.setProperty('--card-accent', w.accent);
    card.setAttribute('aria-label', `Enter ${w.name}`);
    card.innerHTML = `
      <span class="glyph">${w.icon}</span>
      <span class="card-index">0${i+1}</span>
      <h3>${w.name}</h3>
      <p>${w.pitch}</p>
      <span class="enter-row">Enter <span class="arrow">&rarr;</span></span>
    `;
    card.addEventListener('click', () => enterWorld(w.id));
    cardGrid.appendChild(card);
  });

  // ---------- hub starfield background ----------
  (function hubBackground(){
    const canvas = document.getElementById('hub-canvas');
    const container = canvas.parentElement;
    let stars = [];
    function init(){
      const { w, h } = Utils.fitCanvas(canvas, container);
      const count = Math.floor((w * h) / 3800);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.3 + .2,
        p: Math.random() * Math.PI * 2,
        s: Utils.rand(.5, 1.6)
      }));
    }
    init();
    window.addEventListener('resize', init);
    let mx = 0, my = 0;
    window.addEventListener('mousemove', e => {
      mx = (e.clientX / window.innerWidth - .5);
      my = (e.clientY / window.innerHeight - .5);
    });
    Utils.loop((dt, now) => {
      if (!hub.classList.contains('active')) return;
      const ctx = canvas.getContext('2d');
      const w = container.clientWidth, h = container.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w*.5, h*.35, 0, w*.5, h*.35, Math.max(w,h)*.7);
      g.addColorStop(0, 'rgba(90,70,180,.14)');
      g.addColorStop(1, 'rgba(5,6,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#fff';
      for (const s of stars){
        const tw = .55 + .45 * Math.sin(now * .001 * s.s + s.p);
        ctx.globalAlpha = tw * .8;
        ctx.beginPath();
        ctx.arc(s.x + mx * 14, s.y + my * 10, s.r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  })();

  // ---------- mute toggle ----------
  let muted = true;
  muteBtn.setAttribute('aria-pressed', 'false');
  muteBtn.querySelector('.txt').textContent = 'Sound off';
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    Audio2.setMuted(muted);
    Audio2.resume();
    muteBtn.setAttribute('aria-pressed', String(!muted));
    muteBtn.querySelector('.txt').textContent = muted ? 'Sound off' : 'Sound on';
    if (!muted) Audio2.tone(660, .08, { type: 'sine', gain: .18 });
  });

  // ---------- router ----------
  function enterWorld(id){
    if (switching || current) return;
    const mod = window.WORLDS && window.WORLDS[id];
    if (!mod){ console.warn('World not registered:', id); return; }
    switching = true;
    Audio2.resume();
    veil.classList.add('show');
    setTimeout(() => {
      hub.classList.remove('active');
      mount.innerHTML = '';
      const worldEl = document.createElement('div');
      worldEl.className = 'world-root';
      worldEl.style.cssText = 'position:absolute;inset:0;';
      mount.appendChild(worldEl);
      mod.mount(worldEl, { exit: exitWorld, audio: Audio2 });
      current = { id, mod };
      stage.classList.add('active');
      requestAnimationFrame(() => {
        veil.classList.remove('show');
        switching = false;
      });
    }, 280);
  }

  function exitWorld(){
    if (switching || !current) return;
    switching = true;
    veil.classList.add('show');
    setTimeout(() => {
      try{ current.mod.unmount(); }catch(e){ console.error(e); }
      stage.classList.remove('active');
      mount.innerHTML = '';
      current = null;
      hub.classList.add('active');
      requestAnimationFrame(() => {
        veil.classList.remove('show');
        switching = false;
      });
    }, 280);
  }

  backBtn.addEventListener('click', exitWorld);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && current && !switching) exitWorld();
  });

  // initial state
  hub.classList.add('active');
})();

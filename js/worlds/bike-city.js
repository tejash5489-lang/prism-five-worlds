/* ============================================================
   OPEN BIKE CITY — top-down playable mini-game.
   WASD/arrows to ride, Space to hop, Shift to boost, collect orbs.
   ============================================================ */
(function(){
  const { clamp, rand, randInt, lerp, loop, fitCanvas } = Utils;

  const WORLD_W = 2400, WORLD_H = 1800;
  const COLS = 5, ROWS = 4;

  let root, canvas, wrap, stop, ro, audio;
  let keys = {};
  let buildings = [], ramps = [], orbs = [];
  let player, camera = {x:0,y:0};
  let score = 0, best = 0;
  let particles = [];
  let shakeT = 0;
  let bannerT = 0, bannerText = '';
  let trail = [];

  function buildCity(){
    buildings = []; ramps = []; orbs = [];
    const cw = WORLD_W / COLS, ch = WORLD_H / ROWS;
    const margin = 46;
    for (let r = 0; r < ROWS; r++){
      for (let c = 0; c < COLS; c++){
        if (Math.random() < .16) continue; // leave a plaza gap sometimes
        const cellX = c*cw, cellY = r*ch;
        const bw = rand(cw*0.4, cw-margin*2);
        const bh = rand(ch*0.4, ch-margin*2);
        const bx = cellX + margin + Math.random()*(cw - bw - margin*2);
        const by = cellY + margin + Math.random()*(ch - bh - margin*2);
        buildings.push({ x:bx, y:by, w:bw, h:bh, tint: randInt(0,3) });
      }
    }
    // ramps at some interior grid intersections
    for (let r = 1; r < ROWS; r++){
      for (let c = 1; c < COLS; c++){
        if (Math.random() < .55) continue;
        ramps.push({ x: c*cw, y: r*ch, r: 40 });
      }
    }
    spawnOrbs(22);
  }

  function insideAnyBuilding(x,y,pad){
    for (const b of buildings){
      if (x > b.x-pad && x < b.x+b.w+pad && y > b.y-pad && y < b.y+b.h+pad) return true;
    }
    return false;
  }

  function spawnOrbs(n){
    orbs = [];
    let tries = 0;
    while (orbs.length < n && tries < n*40){
      tries++;
      const x = rand(60, WORLD_W-60), y = rand(60, WORLD_H-60);
      if (insideAnyBuilding(x,y,30)) continue;
      orbs.push({ x, y, spin: Math.random()*Math.PI*2, taken:false });
    }
  }

  function resetPlayer(){
    player = {
      x: WORLD_W*0.15, y: WORLD_H*0.15, angle: 0.4,
      speed: 0, boost: 100, boosting:false,
      airT: 0, jumpCd: 0,
    };
    trail = [];
  }

  function spawnBurst(x,y,col,n){
    for (let i=0;i<n;i++){
      particles.push({
        x,y, vx: rand(-140,140), vy: rand(-140,140), life: rand(.35,.7), age:0, col
      });
    }
  }

  function update(dt){
    if (bannerT > 0) bannerT -= dt;
    // steering & throttle
    let steer = 0;
    if (keys['a']||keys['arrowleft']) steer -= 1;
    if (keys['d']||keys['arrowright']) steer += 1;
    let throttle = 0;
    if (keys['w']||keys['arrowup']) throttle += 1;
    if (keys['s']||keys['arrowdown']) throttle -= 1;

    const boosting = (keys['shift']) && player.boost > 4 && throttle > 0;
    player.boosting = boosting;
    const maxSpeed = boosting ? 620 : 360;
    const accel = boosting ? 620 : 420;

    if (throttle > 0) player.speed = Math.min(maxSpeed, player.speed + accel*dt);
    else if (throttle < 0) player.speed = Math.max(-220, player.speed - accel*dt);
    else player.speed = lerp(player.speed, 0, Math.min(1, dt*1.6));

    if (boosting) player.boost = Math.max(0, player.boost - 40*dt);
    else player.boost = Math.min(100, player.boost + 14*dt);

    const speedFrac = clamp(Math.abs(player.speed)/maxSpeed, 0, 1);
    player.angle += steer * dt * (2.6 * (0.35+speedFrac*0.9)) * (player.speed<0?-1:1);

    const nx = player.x + Math.cos(player.angle) * player.speed * dt;
    const ny = player.y + Math.sin(player.angle) * player.speed * dt;

    // jump input
    if (player.jumpCd > 0) player.jumpCd -= dt;
    if (keys[' '] && player.jumpCd <= 0){
      player.jumpCd = 1.0;
      player.airT = 0.45;
      audio.tone(520, .12, { type:'square', gain:.15, slideTo: 780 });
    }
    if (player.airT > 0) player.airT -= dt;

    // collisions with buildings (skip while airborne)
    let px = nx, py = ny;
    if (player.airT <= 0){
      const testR = 16;
      for (const b of buildings){
        const cx = clamp(nx, b.x, b.x+b.w);
        const cy = clamp(ny, b.y, b.y+b.h);
        const dx = nx-cx, dy = ny-cy;
        const d2 = dx*dx+dy*dy;
        if (d2 < testR*testR){
          const d = Math.sqrt(d2) || 0.001;
          const push = (testR-d);
          px = nx + (dx/d)*push;
          py = ny + (dy/d)*push;
          player.speed *= -0.35;
          shakeT = .18;
          audio.noise(.08, { freq: 300, gain:.18 });
          spawnBurst(px,py,'220,220,230', 6);
        }
      }
    }

    player.x = clamp(px, 20, WORLD_W-20);
    player.y = clamp(py, 20, WORLD_H-20);

    // ramps
    for (const rp of ramps){
      const d2 = (player.x-rp.x)**2 + (player.y-rp.y)**2;
      if (d2 < rp.r*rp.r && player.airT <= 0 && Math.abs(player.speed) > 120){
        player.airT = 0.6;
        player.speed *= 1.15;
        score += 50;
        bannerT = 1.1; bannerText = '+50 AIR!';
        audio.tone(300, .25, { type:'sawtooth', gain:.16, slideTo: 900 });
        spawnBurst(player.x, player.y, '255,190,90', 14);
      }
    }

    // orb collection
    for (const o of orbs){
      if (o.taken) continue;
      const d2 = (player.x-o.x)**2 + (player.y-o.y)**2;
      if (d2 < 26*26){
        o.taken = true; score += 10;
        audio.tone(880, .1, { type:'sine', gain:.2, slideTo: 1200 });
        spawnBurst(o.x,o.y,'120,235,255',10);
      }
    }
    if (orbs.every(o=>o.taken)){
      bannerT = 1.6; bannerText = 'LAP COMPLETE — orbs reset';
      spawnOrbs(22);
    }

    // trail
    trail.push({x:player.x,y:player.y});
    if (trail.length > 22) trail.shift();

    // particles
    for (const p of particles){
      p.age += dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.9; p.vy *= 0.9;
    }
    particles = particles.filter(p => p.age < p.life);

    if (shakeT > 0) shakeT -= dt;
    best = Math.max(best, score);

    // camera
    camera.x = clamp(player.x - wrap.clientWidth/2, 0, Math.max(0,WORLD_W - wrap.clientWidth));
    camera.y = clamp(player.y - wrap.clientHeight/2, 0, Math.max(0,WORLD_H - wrap.clientHeight));
  }

  const TINTS = [ ['#2a3550','#1c2438'], ['#33304f','#211f36'], ['#2f3d3d','#1e2929'], ['#3c2f45','#26202e'] ];

  function render(ctx, w, h){
    ctx.save();
    if (shakeT > 0){
      ctx.translate(rand(-4,4)*shakeT*5, rand(-4,4)*shakeT*5);
    }
    ctx.fillStyle = '#141826';
    ctx.fillRect(0,0,w,h);
    ctx.translate(-camera.x, -camera.y);

    // road grid
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 2;
    const cw = WORLD_W/COLS, ch = WORLD_H/ROWS;
    for (let c=0;c<=COLS;c++){ ctx.beginPath(); ctx.moveTo(c*cw,0); ctx.lineTo(c*cw,WORLD_H); ctx.stroke(); }
    for (let r=0;r<=ROWS;r++){ ctx.beginPath(); ctx.moveTo(0,r*ch); ctx.lineTo(WORLD_W,r*ch); ctx.stroke(); }

    // ramps
    for (const rp of ramps){
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,200,90,.18)';
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,90,.6)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(rp.x-16,rp.y+10); ctx.lineTo(rp.x,rp.y-16); ctx.lineTo(rp.x+16,rp.y+10); ctx.closePath(); ctx.stroke();
    }

    // buildings
    for (const b of buildings){
      const [top, side] = TINTS[b.tint];
      ctx.fillStyle = side;
      ctx.fillRect(b.x+6, b.y+8, b.w, b.h);
      ctx.fillStyle = top;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,229,255,.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    // orbs
    const t = performance.now()*0.003;
    for (const o of orbs){
      if (o.taken) continue;
      const bob = Math.sin(t + o.spin)*4;
      ctx.beginPath();
      const grad = ctx.createRadialGradient(o.x,o.y+bob,0,o.x,o.y+bob,14);
      grad.addColorStop(0,'rgba(150,240,255,.95)');
      grad.addColorStop(1,'rgba(150,240,255,0)');
      ctx.fillStyle = grad;
      ctx.arc(o.x,o.y+bob,14,0,Math.PI*2); ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#dffcff';
      ctx.arc(o.x,o.y+bob,4.5,0,Math.PI*2); ctx.fill();
    }

    // trail
    ctx.beginPath();
    trail.forEach((p,i) => { if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
    ctx.strokeStyle = 'rgba(0,229,255,.35)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // particles
    for (const p of particles){
      const f = 1 - p.age/p.life;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.col},${f})`;
      ctx.arc(p.x,p.y,3*f+1,0,Math.PI*2); ctx.fill();
    }

    // player
    const air = player.airT > 0;
    const scale = air ? 1.25 : 1;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (air){
      ctx.save();
      ctx.globalAlpha = .35;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, 10, 14, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    ctx.rotate(player.angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = player.boosting ? '#ff2fd0' : '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(16,0); ctx.lineTo(-10,-8); ctx.lineTo(-6,0); ctx.lineTo(-10,8); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0c0f18';
    ctx.beginPath(); ctx.arc(-8,-7,3.4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-8,7,3.4,0,Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function renderHud(ctx, w, h){
    ctx.save();
    ctx.font = '600 13px Segoe UI, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';

    // boost bar
    const bw = 160, bh = 10, bx = 24, by = h-42;
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle = player.boost > 4 ? '#00e5ff' : '#555';
    ctx.fillRect(bx,by, bw*(player.boost/100), bh);
    ctx.fillStyle = '#cfd6e8';
    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.fillText('BOOST', bx, by-16);

    // score
    ctx.font = '700 22px Segoe UI, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${score}`, 24, 24);
    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.fillStyle = '#8fa0c0';
    ctx.fillText('SCORE', 24, 50);

    // minimap
    const mmW = 130, mmH = 98, mmX = w-mmW-20, mmY = h-mmH-20;
    ctx.fillStyle = 'rgba(6,8,14,.55)';
    ctx.fillRect(mmX,mmY,mmW,mmH);
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.strokeRect(mmX,mmY,mmW,mmH);
    const sx = mmW/WORLD_W, sy = mmH/WORLD_H;
    ctx.fillStyle = 'rgba(0,229,255,.5)';
    for (const b of buildings) ctx.fillRect(mmX+b.x*sx, mmY+b.y*sy, Math.max(1,b.w*sx), Math.max(1,b.h*sy));
    ctx.fillStyle = '#9df';
    for (const o of orbs) if(!o.taken) ctx.fillRect(mmX+o.x*sx-1, mmY+o.y*sy-1, 2, 2);
    ctx.fillStyle = '#ff2fd0';
    ctx.beginPath(); ctx.arc(mmX+player.x*sx, mmY+player.y*sy, 3, 0, Math.PI*2); ctx.fill();

    // banner
    if (bannerT > 0){
      ctx.globalAlpha = clamp(bannerT,0,1);
      ctx.font = '700 20px Segoe UI, sans-serif';
      ctx.fillStyle = '#ffe27a';
      ctx.textAlign = 'center';
      ctx.fillText(bannerText, w/2, 26);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function mount(container, api){
    root = container; audio = api.audio;
    root.innerHTML = `
      <div class="bc-wrap">
        <canvas class="bc-canvas"></canvas>
        <div class="bc-legend">WASD / Arrows — ride &nbsp;·&nbsp; Space — hop &nbsp;·&nbsp; Shift — boost &nbsp;·&nbsp; grab the orbs</div>
      </div>`;
    if (!document.getElementById('bc-style')){
      const style = document.createElement('style');
      style.id = 'bc-style';
      style.textContent = `
        .bc-wrap{ position:absolute; inset:0; background:#141826; overflow:hidden; }
        .bc-canvas{ position:absolute; inset:0; width:100%; height:100%; display:block; cursor:crosshair; }
        .bc-legend{ position:absolute; bottom:16px; left:50%; transform:translateX(-50%);
          background: rgba(6,8,14,.55); border:1px solid rgba(255,255,255,.12); backdrop-filter: blur(6px);
          padding:8px 16px; border-radius:999px; font-size:12.5px; color:#cfe3ff; letter-spacing:.02em;
          animation: bc-fade 6s ease forwards; pointer-events:none; }
        @keyframes bc-fade{ 0%,70%{ opacity:1; } 100%{ opacity:0; } }
      `;
      document.head.appendChild(style);
    }
    wrap = root.querySelector('.bc-wrap');
    canvas = root.querySelector('.bc-canvas');
    fitCanvas(canvas, wrap);
    buildCity();
    resetPlayer();
    score = 0; particles = [];

    function onKey(e, down){
      const k = e.key.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
      keys[k] = down;
    }
    const kd = e => onKey(e, true);
    const ku = e => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    function onResize(){ fitCanvas(canvas, wrap); }
    window.addEventListener('resize', onResize);
    ro = onResize;

    stop = loop((dt) => {
      update(Math.min(dt, .033));
      const ctx = canvas.getContext('2d');
      render(ctx, wrap.clientWidth, wrap.clientHeight);
      renderHud(ctx, wrap.clientWidth, wrap.clientHeight);
    });

    mount._kd = kd; mount._ku = ku;
  }

  function unmount(){
    if (stop) stop();
    if (ro) window.removeEventListener('resize', ro);
    if (mount._kd) window.removeEventListener('keydown', mount._kd);
    if (mount._ku) window.removeEventListener('keyup', mount._ku);
    keys = {};
    root.innerHTML = '';
    root = canvas = wrap = stop = ro = null;
  }

  window.WORLDS = window.WORLDS || {};
  window.WORLDS.bike = { mount, unmount };
})();

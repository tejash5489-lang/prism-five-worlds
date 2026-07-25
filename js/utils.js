/* ============================================================
   PRISM — shared utilities (no modules, plain globals for file:// safety)
   ============================================================ */
(function(){

  function fitCanvas(canvas, container){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = container.clientWidth, h = container.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  }

  function lerp(a, b, t){ return a + (b - a) * t; }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function rand(a, b){ return a + Math.random() * (b - a); }
  function randInt(a, b){ return Math.floor(rand(a, b + 1)); }
  function dist2(x1,y1,x2,y2){ const dx=x2-x1, dy=y2-y1; return dx*dx+dy*dy; }
  function smoothstep(edge0, edge1, x){
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  // rAF-driven loop with automatic cleanup handle
  function loop(fn){
    let raf = null, running = true;
    let last = performance.now();
    function tick(now){
      if (!running) return;
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      fn(dt, now);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return function stop(){ running = false; if (raf) cancelAnimationFrame(raf); };
  }

  window.Utils = { fitCanvas, lerp, clamp, rand, randInt, dist2, smoothstep, pick, loop };
})();

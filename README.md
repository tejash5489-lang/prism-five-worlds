# PRISM — five worlds, one light

A single-page hub that opens into five small, fully interactive worlds — a scroll-driven
cosmic film, a top-down bike game, a living ecosystem sim, an explorable constellation,
and a tense scan-the-grid heist. No backend, no build step, no framework: plain HTML,
CSS, and Canvas 2D JavaScript.

## Run it

From this folder:

```bash
npm start
```

This runs `npx serve` on **http://localhost:5600**. No Node? Just open `index.html`
directly in a browser (double-click it — everything is plain `<script>` tags, no
modules, so it works over `file://` too), or serve the folder any other way
(`python -m http.server 5600`).

## The five worlds

| World | Type | What you do |
|---|---|---|
| **Origin Scroll** | scroll-story | Scroll through cosmic time — cloud, collapse, ignition, worlds, us — with a mouse-parallax particle field reacting under your cursor. |
| **Open Bike City** | mini-game | Ride an open city block. `WASD`/arrows to steer, `Space` to hop, `Shift` to boost. Chase glowing orbs, launch off ramps, don't total the bike on a building. |
| **Tide Pool Lab** | living sim | Click or drag the water to spawn algae, grazers, and predators. Tune sunlight and rain and watch the food chain rise and crash in real time. |
| **Atlas of Echoes** | explore | Click the lit points on a dark constellation map to recover nine short "echoes." Recover all nine and the atlas changes. |
| **Glyph Heist** | reflex | Scan a 6×6 grid of runes to find the passcode letters before the trace meter fills. Every scan feeds the trace — no wasted clicks. |

Each world has its own **Back to hub** button (top-left) and `Esc` also returns you to
the hub from anywhere.

## Structure

```
five-worlds/
  index.html              hub shell + world-stage mount point
  css/main.css             shared brand, hub layout, transitions
  js/utils.js               canvas fit / math helpers, rAF loop wrapper
  js/audio.js                shared WebAudio synth bus (mute-by-default)
  js/main.js                  hub cards, starfield background, router
  js/worlds/origin-scroll.js  world 1
  js/worlds/bike-city.js       world 2
  js/worlds/tide-pool.js        world 3
  js/worlds/atlas-echoes.js      world 4
  js/worlds/glyph-heist.js        world 5
```

There's no bundler and no ES modules — every world file is a plain `<script>` that
registers itself onto a shared `window.WORLDS.<id> = { mount(container, api), unmount() }`
object. `js/main.js` is the router: it swaps a CSS class between the hub and the
world-stage, mounts/unmounts the chosen world's module, and crossfades through a black
veil between the two.

## Notes

- **Sound** is off by default (per-spec) — toggle it with the pill button top-right of
  the hub. All audio is synthesized on the fly with WebAudio (no audio files).
- **Atlas of Echoes** remembers which echoes you've recovered in `localStorage`, so
  progress survives a reload.
- Everything renders on Canvas 2D at the container's device pixel ratio (capped at 2x)
  and runs on `requestAnimationFrame`, targeting 60fps on a normal laptop.

import { useEffect, useRef, useState } from "react";
import { useCityPlay } from "../components/CityPlay.jsx";
import { drawRat } from "./ratSprite.js";
import { squeak } from "./sound.js";

// Surfaces rats will run along: the top edges of panels, signs and cards.
const LEDGES =
  ".panel, .station-sign, .stats-grid, .filter-bar, .fact-ticket, .souvenir-ticket, .closing, .zip-sidebar, .historical-record";
const FLEE_RADIUS = 110;

const rand = (a, b) => a + Math.random() * (b - a);

// The street layer: a full-screen canvas above the page that never takes
// clicks. Rats run the bottom of the screen and the top edges of panels, duck
// into litter piles, and bolt from the cursor. Flies circle the trash.
export default function NightLayer() {
  const { motion, sound, setSound, setNight } = useCityPlay();
  const canvasRef = useRef(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const [startled, setStartled] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w = 0,
      h = 0,
      dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const pointer = { x: -9999, y: -9999 };
    const onPointer = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let ledges = [],
      hideouts = [];
    const scan = () => {
      ledges = [...document.querySelectorAll(LEDGES)].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 220 && r.top > 100 && r.top < h - 80;
      });
      hideouts = [...document.querySelectorAll("[data-hideout]")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 60 && r.top < h - 20 && r.width > 0;
      });
    };
    scan();
    const scanner = setInterval(scan, 600);

    // Element boxes, measured at most once per frame however many rats and
    // flies ask for them.
    const boxes = new Map();
    const box = (el) => {
      let r = boxes.get(el);
      if (!r) boxes.set(el, (r = el.getBoundingClientRect()));
      return r;
    };
    // Where a rat stands: the street, a ledge's top edge, or a litter pile.
    const floorOf = (rat) => {
      if (rat.floor === "street") return { y: h - 4, x0: -120, x1: w + 120 };
      const r = rat.el && box(rat.el);
      if (!r || !rat.el.isConnected) return null;
      return rat.floor === "ledge"
        ? { y: r.top + 1, x0: r.left + 6, x1: r.right - 6 }
        : { y: r.bottom - 2, x0: r.left - 90, x1: r.right + 90 };
    };

    const spawn = (rat = {}) => {
      const size = rand(30, 46);
      const options = ["street", "street"];
      if (ledges.length) options.push("ledge");
      if (hideouts.length) options.push("hideout", "hideout");
      const floor = options[Math.floor(Math.random() * options.length)];
      const dir = Math.random() < 0.5 ? 1 : -1;
      Object.assign(rat, {
        floor,
        el: null,
        size,
        dir,
        speed: rand(70, 130),
        state: "run",
        timer: rand(1, 4),
        stride: Math.random() * 10,
        vy: 0,
        drop: 0,
        hidden: 0,
        appear: 0,
        lastStartle: -10,
      });
      if (floor === "street") rat.x = dir > 0 ? -60 : w + 60;
      if (floor === "ledge") {
        rat.el = ledges[Math.floor(Math.random() * ledges.length)];
        const f = floorOf(rat);
        rat.x = dir > 0 ? f.x0 : f.x1;
      }
      if (floor === "hideout") {
        rat.el = hideouts[Math.floor(Math.random() * hideouts.length)];
        const r = rat.el.getBoundingClientRect();
        rat.x = r.left + r.width / 2;
        rat.state = "emerge";
        rat.timer = rand(0.6, 1.2);
      }
      return rat;
    };

    const count = window.innerWidth < 640 ? 3 : 6;
    const rats = Array.from({ length: count }, () => spawn());
    rats.forEach((r, i) => {
      r.hidden = i * 1.4; // stagger the first arrivals
    });
    const flies = Array.from({ length: 36 }, () => ({
      a: rand(1.5, 3.5),
      b: rand(2, 4.5),
      p: rand(0, Math.PI * 2),
      rx: rand(18, 46),
      ry: rand(10, 26),
    }));
    const drops = Array.from({ length: window.innerWidth < 640 ? 35 : 80 }, () => ({
      x: rand(0, w),
      y: rand(-h, h),
      len: rand(8, 18),
      v: rand(480, 760),
    }));

    let last = performance.now(),
      clock = 0,
      frame;

    const step = (dt) => {
      clock += dt;
      for (const rat of rats) {
        if (rat.hidden > 0) {
          rat.hidden -= dt;
          if (rat.hidden <= 0) spawn(rat);
          continue;
        }
        const f = floorOf(rat);
        if (!f) {
          rat.hidden = rand(1, 3);
          continue;
        }
        // Falling off a ledge onto the street.
        if (rat.state === "fall") {
          rat.vy += 1800 * dt;
          rat.drop += rat.vy * dt;
          rat.x += rat.dir * rat.speed * dt;
          if (f.y + rat.drop >= h - 4) {
            rat.floor = "street";
            rat.el = null;
            rat.drop = 0;
            rat.vy = 0;
            rat.state = "run";
          }
          continue;
        }
        const y = f.y;
        // Bolt from the cursor.
        const dx = rat.x - pointer.x,
          dy = y - 12 - pointer.y;
        if (dx * dx + dy * dy < FLEE_RADIUS ** 2 && rat.state !== "emerge") {
          if (rat.state !== "flee") {
            rat.state = "flee";
            rat.timer = rand(0.8, 1.3);
            rat.dir = dx >= 0 ? 1 : -1;
            if (clock - rat.lastStartle > 1.5) {
              rat.lastStartle = clock;
              setStartled((n) => n + 1);
              if (soundRef.current) squeak();
            }
          }
        }
        rat.timer -= dt;
        if (rat.state === "emerge") {
          rat.appear = Math.min(1, rat.appear + dt * 2.5);
          if (rat.timer <= 0) {
            rat.state = "pause";
            rat.timer = rand(0.6, 1.6);
          }
          continue;
        }
        rat.appear = 1;
        if (rat.state === "pause") {
          if (rat.timer <= 0) {
            rat.state = "run";
            rat.timer = rand(1.5, 4);
            if (Math.random() < 0.35) rat.dir *= -1;
          }
          continue;
        }
        const speed = rat.state === "flee" ? 430 : rat.speed;
        rat.x += rat.dir * speed * dt;
        rat.stride += (speed * dt) / 16;
        if (rat.state === "flee" && rat.timer <= 0) rat.state = "run";
        if (rat.state === "run" && rat.timer <= 0) {
          rat.state = "pause";
          rat.timer = rand(0.7, 2.2);
        }
        // Diving into a nearby pile when spooked.
        if (rat.state === "flee")
          for (const el of hideouts) {
            const r = box(el);
            if (Math.abs(rat.x - (r.left + r.width / 2)) < 50 && Math.abs(y - r.bottom) < 40) {
              rat.hidden = rand(2.5, 6);
              break;
            }
          }
        // Edges: ledges end in a jump down or a turn; the street leads offscreen.
        if (rat.x < f.x0 || rat.x > f.x1) {
          if (rat.floor === "ledge" && Math.random() < 0.6) {
            rat.state = "fall";
            rat.vy = -160;
          } else if (rat.floor === "street") rat.hidden = rand(1, 4);
          else if (rat.floor === "hideout" && Math.random() < 0.5) rat.hidden = rand(2, 5);
          else {
            rat.dir *= -1;
            rat.x = Math.max(f.x0, Math.min(f.x1, rat.x));
          }
        }
      }
      for (const d of drops) {
        d.y += d.v * dt;
        d.x -= d.v * 0.18 * dt;
        if (d.y > h) {
          d.y = rand(-40, 0);
          d.x = rand(0, w + 100);
        }
      }
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (motion) {
        ctx.strokeStyle = "rgba(190, 205, 215, 0.13)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of drops) {
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + d.len * 0.18, d.y - d.len);
        }
        ctx.stroke();
      }
      // Flies over the trash.
      ctx.fillStyle = "rgba(20, 16, 10, 0.9)";
      hideouts.forEach((el, i) => {
        const r = box(el);
        const cx = r.left + r.width / 2,
          cy = r.top + 4;
        for (let j = 0; j < 6; j++) {
          const fly = flies[(i * 6 + j) % flies.length];
          const t = motion ? clock : 0;
          const x = cx + Math.sin(t * fly.a + fly.p) * fly.rx;
          const y = cy + Math.cos(t * fly.b + fly.p) * fly.ry;
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(230, 230, 220, 0.25)";
          ctx.fillRect(x - 2.5, y - 2, 2, 1.2);
          ctx.fillRect(x + 0.5, y - 2, 2, 1.2);
          ctx.fillStyle = "rgba(20, 16, 10, 0.9)";
        }
      });
      for (const rat of rats) {
        if (rat.hidden > 0) continue;
        const f = floorOf(rat);
        if (!f) continue;
        const y = f.y + (rat.state === "fall" ? rat.drop : 0);
        const running = rat.state === "run" || rat.state === "flee" || rat.state === "fall";
        ctx.save();
        ctx.globalAlpha = rat.appear;
        drawRat(ctx, rat.x, y, rat.size * (0.6 + 0.4 * rat.appear), {
          dir: rat.dir,
          stride: running ? rat.stride : 0,
          bob: running ? Math.abs(Math.sin(rat.stride * Math.PI)) * 2 : 0,
          sniff: rat.state === "pause" ? (Math.sin(clock * 9) + 1) / 2 : 0,
          tail: Math.sin(clock * (running ? 14 : 3) + rat.size) * (running ? 0.18 : 0.08),
        });
        ctx.restore();
      }
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        boxes.clear();
        step(dt);
        draw();
      }
      frame = requestAnimationFrame(loop);
    };
    if (motion) frame = requestAnimationFrame(loop);
    else {
      // Motion off: a still scene, a few rats sitting by the trash.
      rats.forEach((rat, i) => {
        rat.hidden = 0;
        rat.appear = 1;
        rat.state = "pause";
        if (hideouts[i]) {
          rat.floor = "hideout";
          rat.el = hideouts[i];
          const r = hideouts[i].getBoundingClientRect();
          rat.x = r.right + 18;
        } else {
          rat.floor = "street";
          rat.x = 60 + i * 140;
        }
      });
      draw();
    }
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(scanner);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [motion]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="street-layer"
        data-paused={motion ? undefined : ""}
        aria-hidden="true"
      />
      <div className="night-hud" role="region" aria-label="Night shift controls">
        <span className="hud-lamp" aria-hidden="true" />
        <span className="mono hud-title">NIGHT SHIFT</span>
        <span className="mono hud-count" data-testid="startled-count">
          {startled} {startled === 1 ? "rat" : "rats"} startled
        </span>
        <button
          className="mono"
          aria-pressed={sound}
          onClick={() => {
            const next = !sound;
            setSound(next);
            if (next) squeak();
          }}
        >
          Sound {sound ? "on" : "off"}
        </button>
        <button className="mono" onClick={() => setNight(false)}>
          Lights on
        </button>
      </div>
    </>
  );
}

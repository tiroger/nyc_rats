import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { useCityPlay } from "../components/CityPlay.jsx";
import { drawRat } from "./ratSprite.js";
import { rumble, squeak, thump } from "./sound.js";

const { Engine, Bodies, Body, Composite, Events, Mouse, MouseConstraint } = Matter;

const CURB = 58; // sidewalk height above the canvas bottom
// Phones get a shorter stage and less trash, so the pile stays playable.
const stageFor = (width) =>
  width < 640 ? { height: 300, maxTrash: 9, start: 5 } : { height: 380, maxTrash: 18, start: 9 };
const rand = (a, b) => a + Math.random() * (b - a);

function makeTrash(kind, x, y) {
  const common = { friction: 0.8, frictionAir: 0.01, restitution: 0.25 };
  if (kind === "bag")
    return Bodies.circle(x, y, rand(20, 28), { ...common, density: 0.0016, label: "bag", tone: Math.random() < 0.35 ? "#283727" : "#1b1e1a" });
  if (kind === "can")
    return Bodies.rectangle(x, y, 14, 26, { ...common, restitution: 0.45, density: 0.002, label: "can", chamfer: { radius: 3 } });
  return Bodies.rectangle(x, y, 64, 10, { ...common, density: 0.001, label: "box", chamfer: { radius: 2 } });
}

function drawTrash(ctx, body) {
  const { x, y } = body.position;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle);
  if (body.label === "bag") {
    const r = body.circleRadius;
    ctx.fillStyle = body.tone;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.7);
    ctx.bezierCurveTo(-r * 1.25, -r * 0.2, -r * 0.55, -r * 0.95, -r * 0.12, -r * 0.95);
    ctx.lineTo(-r * 0.2, -r * 1.3);
    ctx.lineTo(r * 0.2, -r * 1.3);
    ctx.lineTo(r * 0.12, -r * 0.95);
    ctx.bezierCurveTo(r * 0.55, -r * 0.95, r * 1.25, -r * 0.2, r * 0.9, r * 0.7);
    ctx.quadraticCurveTo(0, r * 1.05, -r * 0.9, r * 0.7);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 220, 160, 0.22)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.1, r * 0.55, Math.PI * 1.05, Math.PI * 1.45);
    ctx.stroke();
  } else if (body.label === "can") {
    ctx.fillStyle = "#9aa19a";
    ctx.fillRect(-7, -13, 14, 26);
    ctx.fillStyle = "#b6402f";
    ctx.fillRect(-7, -5, 14, 9);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(-4, -12, 2, 24);
  } else {
    ctx.fillStyle = "#a77a48";
    ctx.fillRect(-32, -5, 64, 10);
    ctx.fillStyle = "rgba(70, 40, 15, 0.55)";
    ctx.beginPath();
    ctx.ellipse(8, 0, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTruck(ctx, x, ground, t) {
  ctx.save();
  ctx.translate(x, ground);
  // Hopper at the back (truck drives right to left, hopper trails on the right).
  ctx.fillStyle = "#e9e6dc";
  ctx.fillRect(0, -92, 190, 72);
  ctx.fillStyle = "#3d7c55";
  ctx.fillRect(0, -50, 190, 9);
  ctx.fillStyle = "#cfcabc";
  ctx.fillRect(150, -100, 46, 80);
  ctx.fillStyle = "#1d1f1c";
  ctx.fillRect(160, -88, 30, 34);
  // Cab.
  ctx.fillStyle = "#e9e6dc";
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(-58, -20);
  ctx.lineTo(-58, -62);
  ctx.lineTo(-36, -82);
  ctx.lineTo(0, -82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#9fc3d6";
  ctx.fillRect(-46, -76, 28, 20);
  ctx.font = "700 11px 'Space Mono', monospace";
  ctx.fillStyle = "#2f4a3a";
  ctx.fillText("NIGHT PICKUP", 30, -62);
  // Flashing amber light.
  ctx.fillStyle = Math.floor(t * 6) % 2 ? "#ffb547" : "#7a5522";
  ctx.beginPath();
  ctx.arc(-24, -86, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 181, 71, 0.18)";
  ctx.beginPath();
  ctx.arc(-24, -86, 16, 0, Math.PI * 2);
  ctx.fill();
  // Wheels.
  for (const wx of [-30, 40, 150]) {
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(wx, -14, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wx, -14, 7, t * 10, t * 10 + 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBin(ctx, x, ground, lidOpen) {
  ctx.save();
  ctx.translate(x, ground);
  ctx.fillStyle = "#2f5a43";
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(-34, -78);
  ctx.lineTo(34, -78);
  ctx.lineTo(30, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#24463a";
  ctx.lineWidth = 4;
  for (const lx of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(lx, -8);
    ctx.lineTo(lx * 1.1, -70);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(-36, -80);
  ctx.rotate(lidOpen ? -0.9 : 0);
  ctx.fillStyle = "#3b6c51";
  ctx.fillRect(0, -6, 72, 8);
  ctx.restore();
  ctx.font = "700 9px 'Space Mono', monospace";
  ctx.fillStyle = "#cfe3a8";
  ctx.textAlign = "center";
  ctx.fillText("SEALED", 0, -40);
  ctx.restore();
}

export default function Curbside() {
  const { motion, sound } = useCityPlay();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const api = useRef({});
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const [bins, setBins] = useState(false);
  const [status, setStatus] = useState({ trash: 0, rats: 0, feasting: 0, collected: 0 });
  const binsRef = useRef(bins);
  binsRef.current = bins;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let width = wrapRef.current.clientWidth;
    let { height: HEIGHT, maxTrash: MAX_TRASH, start: START } = stageFor(width);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const engine = Engine.create({ gravity: { y: 1.1 } });
    const ground = () => HEIGHT - CURB;
    let floor, left, right;
    const buildWalls = () => {
      if (floor) Composite.remove(engine.world, [floor, left, right]);
      floor = Bodies.rectangle(width / 2, ground() + 30, width * 3, 60, { isStatic: true, label: "floor", friction: 0.9 });
      left = Bodies.rectangle(-30, HEIGHT / 2, 60, HEIGHT * 3, { isStatic: true });
      right = Bodies.rectangle(width + 30, HEIGHT / 2, 60, HEIGHT * 3, { isStatic: true });
      Composite.add(engine.world, [floor, left, right]);
    };
    const resize = () => {
      width = wrapRef.current.clientWidth;
      ({ height: HEIGHT, maxTrash: MAX_TRASH } = stageFor(width));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${HEIGHT}px`;
      buildWalls();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapRef.current);

    // Dragging and flinging with a mouse or finger. Wheel scrolling stays with
    // the page.
    const mouse = Mouse.create(canvas);
    mouse.pixelRatio = dpr;
    mouse.element.removeEventListener("wheel", mouse.mousewheel);
    mouse.element.removeEventListener("DOMMouseScroll", mouse.mousewheel);
    const grab = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.25, render: { visible: false } } });
    Composite.add(engine.world, grab);

    const trash = () => Composite.allBodies(engine.world).filter((b) => ["bag", "can", "box"].includes(b.label));
    const drop = (kind) => {
      if (trash().length >= MAX_TRASH) return;
      const k = kind || (Math.random() < 0.6 ? "bag" : Math.random() < 0.5 ? "can" : "box");
      const body = makeTrash(k, rand(60, width - 60), -30);
      Body.setAngularVelocity(body, rand(-0.15, 0.15));
      Composite.add(engine.world, body);
    };
    for (let i = 0; i < START; i++) drop(i < START * 0.65 ? "bag" : undefined);

    Events.on(engine, "collisionStart", (event) => {
      if (!soundRef.current) return;
      for (const pair of event.pairs) {
        const speed = Math.max(pair.bodyA.speed, pair.bodyB.speed);
        if (speed > 4 && (pair.bodyA.label === "floor" || pair.bodyB.label === "floor")) thump(speed / 6);
      }
    });

    const pointer = { x: -999, y: -999 };
    const onPointer = (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    };
    const offPointer = () => {
      pointer.x = pointer.y = -999;
    };
    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerleave", offPointer);

    const rats = [];
    const tossed = []; // bags flying into a bin: {x, y, t, tone, r}
    let truck = null,
      clock = 0,
      sinceDrop = 0,
      collected = 0,
      lastStatus = "";

    const food = () => (binsRef.current ? [] : trash().filter((b) => b.label !== "can"));
    const updateRats = (dt) => {
      const meals = food();
      const want = meals.length ? Math.min(8, 1 + Math.round(meals.length * 0.6)) : 0;
      if (rats.filter((r) => !r.leaving).length < want && Math.random() < dt * 1.2)
        rats.push({ x: Math.random() < 0.5 ? -40 : width + 40, size: rand(42, 58), stride: 0, state: "seek", target: null, timer: 0, dir: 1 });
      for (const rat of rats) {
        if (!meals.length && !rat.leaving) {
          rat.leaving = true;
          rat.state = "run";
          rat.dir = rat.x < width / 2 ? -1 : 1;
        }
        // Spooked by the cursor, by flying trash, or by the truck.
        const near = (pointer.x - rat.x) ** 2 + (pointer.y - (ground() - 12)) ** 2 < 70 ** 2;
        const hit = trash().some((b) => b.speed > 7 && Math.abs(b.position.x - rat.x) < 40 && b.position.y > ground() - 80);
        const truckNear = truck && Math.abs(truck.x - rat.x) < 220;
        if ((near || hit || truckNear) && rat.state !== "flee") {
          rat.state = "flee";
          rat.timer = rand(0.8, 1.4);
          rat.dir = truckNear ? (rat.x < truck.x ? -1 : 1) : near ? Math.sign(rat.x - pointer.x) || 1 : Math.random() < 0.5 ? -1 : 1;
          if (soundRef.current) squeak();
        }
        rat.timer -= dt;
        if (rat.state === "flee") {
          rat.x += rat.dir * 380 * dt;
          rat.stride += (380 * dt) / 14;
          if (rat.timer <= 0) rat.state = "seek";
          continue;
        }
        if (rat.leaving) {
          rat.x += rat.dir * 150 * dt;
          rat.stride += (150 * dt) / 14;
          continue;
        }
        if (!rat.target || !Composite.get(engine.world, rat.target.id, "body")) rat.target = meals[Math.floor(Math.random() * meals.length)];
        const tx = rat.target?.position.x ?? rat.x;
        const gap = tx - rat.x;
        if (Math.abs(gap) > 22) {
          rat.state = "seek";
          rat.dir = Math.sign(gap);
          rat.x += rat.dir * 110 * dt;
          rat.stride += (110 * dt) / 14;
        } else rat.state = "feast";
      }
      for (let i = rats.length - 1; i >= 0; i--) if (rats[i].x < -80 || rats[i].x > width + 80) rats.splice(i, 1);
    };

    const step = (dt) => {
      clock += dt;
      sinceDrop += dt;
      if (sinceDrop > 6.5) {
        sinceDrop = 0;
        if (binsRef.current) tossed.push({ x: rand(60, width - 60), y: -30, t: 0, tone: "#1b1e1a", r: 22 });
        else drop();
      }
      // Sealed bins: every loose item gets tidied into the nearest bin.
      if (binsRef.current)
        for (const b of trash()) {
          tossed.push({ x: b.position.x, y: b.position.y, t: 0, tone: b.tone || "#9aa19a", r: b.circleRadius || 12 });
          Composite.remove(engine.world, b);
        }
      for (let i = tossed.length - 1; i >= 0; i--) {
        tossed[i].t += dt * 1.6;
        if (tossed[i].t >= 1) tossed.splice(i, 1);
      }
      if (truck) {
        truck.x -= 260 * dt;
        for (const b of trash())
          if (b.position.x > truck.x + 140 && b.position.x < truck.x + 200) {
            Composite.remove(engine.world, b);
            collected += 1;
          }
        if (truck.x < -260) truck = null;
      }
      Engine.update(engine, dt * 1000);
      updateRats(dt);
      const t = trash().length,
        r = rats.filter((rat) => !rat.leaving).length,
        feasting = rats.filter((rat) => rat.state === "feast").length;
      const key = `${t}|${r}|${feasting}|${collected}`;
      if (key !== lastStatus) {
        lastStatus = key;
        setStatus({ trash: t, rats: r, feasting, collected });
      }
    };

    const binX = () => [width * 0.3, width * 0.7];
    // The street backdrop (brick, a shuttered store, a lamp post) only changes
    // with the width, so it is painted once to an offscreen canvas.
    let backdrop = null,
      backdropWidth = 0;
    const paintBackdrop = () => {
      backdrop = document.createElement("canvas");
      backdrop.width = Math.round(width * dpr);
      backdrop.height = Math.round(HEIGHT * dpr);
      backdropWidth = width + HEIGHT / 1000;
      const b = backdrop.getContext("2d");
      b.scale(dpr, dpr);
      const g = ground();
      b.fillStyle = "#1a1510";
      b.fillRect(0, 0, width, HEIGHT);
      // Brick wall.
      for (let row = 0, y = 0; y < g; row++, y += 14)
        for (let x = row % 2 ? -18 : 0; x < width; x += 36) {
          b.fillStyle = `rgba(${96 + ((x * 7 + y) % 17)}, ${46 + ((x + y * 3) % 11)}, 32, 0.55)`;
          b.fillRect(x + 1, y + 1, 34, 12);
        }
      // Rolling shutter on a closed store.
      const sx = width * 0.52,
        sw = Math.min(360, width * 0.4);
      b.fillStyle = "#3b3c38";
      b.fillRect(sx, 40, sw, g - 40);
      b.strokeStyle = "rgba(0,0,0,0.45)";
      for (let y = 46; y < g; y += 7) {
        b.beginPath();
        b.moveTo(sx, y);
        b.lineTo(sx + sw, y);
        b.stroke();
      }
      b.fillStyle = "rgba(220, 240, 128, 0.75)";
      b.font = "700 26px 'DM Sans', sans-serif";
      b.save();
      b.translate(sx + sw * 0.18, g - 70);
      b.rotate(-0.06);
      b.fillText("RATLAS", 0, 0);
      b.restore();
      b.fillStyle = "#26231e";
      b.fillRect(sx - 6, 30, sw + 12, 12);
      // Lamp post and its pool of sodium light.
      const lx = width * 0.18;
      b.fillStyle = "#0f0e0c";
      b.fillRect(lx - 3, 40, 6, g - 40);
      b.fillRect(lx - 3, 40, 46, 5);
      b.fillStyle = "#ffcf6b";
      b.beginPath();
      b.ellipse(lx + 40, 48, 12, 5, 0, 0, Math.PI * 2);
      b.fill();
      const lamp = b.createRadialGradient(lx + 40, 50, 6, lx + 40, g, Math.max(width, 500) * 0.55);
      lamp.addColorStop(0, "rgba(255, 175, 75, 0.5)");
      lamp.addColorStop(0.4, "rgba(255, 165, 61, 0.14)");
      lamp.addColorStop(1, "rgba(255, 165, 61, 0)");
      b.fillStyle = lamp;
      b.fillRect(0, 0, width, HEIGHT);
      // Sidewalk.
      b.fillStyle = "#2a2620";
      b.fillRect(0, g, width, CURB);
      b.fillStyle = "#3a352c";
      b.fillRect(0, g, width, 5);
      b.strokeStyle = "rgba(0,0,0,0.35)";
      b.lineWidth = 1;
      for (let x = 40; x < width; x += 90) {
        b.beginPath();
        b.moveTo(x, g + 5);
        b.lineTo(x - 20, HEIGHT);
        b.stroke();
      }
    };
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, HEIGHT);
      const g = ground();
      if (!backdrop || backdropWidth !== width + HEIGHT / 1000) paintBackdrop();
      ctx.drawImage(backdrop, 0, 0, width, HEIGHT);
      if (binsRef.current) for (const x of binX()) drawBin(ctx, x, g, tossed.length > 0);
      for (const b of trash()) drawTrash(ctx, b);
      // Items arcing into the bins.
      for (const item of tossed) {
        const [b1, b2] = binX();
        const tx = Math.abs(item.x - b1) < Math.abs(item.x - b2) ? b1 : b2;
        const x = item.x + (tx - item.x) * item.t;
        const y = item.y + (g - 90 - item.y) * item.t - Math.sin(item.t * Math.PI) * 70;
        ctx.fillStyle = item.tone;
        ctx.beginPath();
        ctx.arc(x, y, item.r * (1 - item.t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      for (const rat of rats) {
        const moving = rat.state !== "feast";
        drawRat(ctx, rat.x, g + 2, rat.size, {
          dir: rat.dir,
          stride: moving ? rat.stride : 0,
          bob: moving ? Math.abs(Math.sin(rat.stride * Math.PI)) * 2 : Math.abs(Math.sin(clock * 18)) * 1.2,
          sniff: rat.state === "feast" ? (Math.sin(clock * 14) + 1) / 2 : 0,
          tail: Math.sin(clock * 12 + rat.size) * 0.2,
          rim: "#ffc06b",
        });
      }
      if (truck) drawTruck(ctx, truck.x, g, clock);
    };

    let frame,
      last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        step(dt);
        draw();
      }
      frame = requestAnimationFrame(loop);
    };
    // Let the first trash settle, then run (or freeze if motion is off).
    for (let i = 0; i < 180; i++) Engine.update(engine, 1000 / 60);
    if (motion) frame = requestAnimationFrame(loop);
    else {
      updateRats(1);
      draw();
      setStatus({ trash: trash().length, rats: 0, feasting: 0, collected: 0 });
    }

    api.current = {
      drop: () => {
        if (binsRef.current) tossed.push({ x: rand(60, width - 60), y: -30, t: 0, tone: "#1b1e1a", r: 22 });
        else drop("bag");
        if (!motion) draw();
      },
      truck: () => {
        if (truck) return;
        truck = { x: width + 80 };
        if (soundRef.current) rumble(3.2);
      },
      shake: () => {
        for (const b of trash()) Body.applyForce(b, b.position, { x: rand(-0.03, 0.03) * b.mass, y: -rand(0.04, 0.09) * b.mass });
        if (soundRef.current) squeak();
      },
    };
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", offPointer);
      Mouse.clearSourceEvents(mouse);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, [motion]);

  const feasting = status.feasting;
  const message = bins
    ? status.rats
      ? `Bins sealed. ${status.rats} ${status.rats === 1 ? "rat is" : "rats are"} giving up and heading off.`
      : "Bins sealed. Nothing to eat, so the locals have moved on."
    : `${status.trash} pieces of trash on the curb. ${status.rats} ${status.rats === 1 ? "rat" : "rats"} around, ${feasting} feasting.`;

  return (
    <section className="curbside shell" id="curbside" aria-labelledby="curbside-title">
      <div className="curbside-head">
        <div>
          <div className="eyebrow">AFTER HOURS / CURBSIDE, 2 A.M.</div>
          <h2 id="curbside-title">The late-night buffet.</h2>
          <p>
            Trash goes out at night. So do the locals. Fling the bags around, call a
            pickup, or try sealed bins, and see who sticks around.
          </p>
        </div>
      </div>
      <div className="curbside-stage" ref={wrapRef}>
        <canvas ref={canvasRef} aria-hidden="true" data-testid="curbside-canvas" />
        {!motion && <p className="curbside-frozen mono">Motion is off, so the curb is frozen.</p>}
      </div>
      <div className="curbside-controls">
        <button onClick={() => api.current.drop?.()}>Put out a bag</button>
        <button onClick={() => api.current.shake?.()}>Kick the pile</button>
        <button onClick={() => api.current.truck?.()} disabled={!motion}>
          Call a night pickup
        </button>
        <button aria-pressed={bins} onClick={() => setBins((value) => !value)}>
          {bins ? "Back to bags on the curb" : "Use sealed bins"}
        </button>
        <p className="curbside-status mono" role="status" aria-live="polite" data-testid="curbside-status">
          {message}
          {status.collected ? ` Pickups so far: ${status.collected} items.` : ""}
        </p>
      </div>
      <p className="curbside-note">
        The joke has a point: rats follow food. NYC Health's Rat Academy advice is to
        starve rats out by keeping garbage and food away from them; with nothing to
        eat, they move on.
      </p>
    </section>
  );
}

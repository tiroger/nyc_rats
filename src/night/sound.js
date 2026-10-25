// Tiny synthesized sounds for the Night shift. No audio files: everything is
// generated with Web Audio, and nothing plays unless the visitor turns sound on.
let context = null;

function audio() {
  if (!context) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    context = new Context();
  }
  if (context.state === "suspended") context.resume();
  return context;
}

function envelope(ctx, start, peak, length) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  gain.connect(ctx.destination);
  return gain;
}

// A rat squeak: two quick chirps that sweep up and down.
export function squeak() {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const pitch = 2600 + Math.random() * 1400;
  for (const offset of [0, 0.09]) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(pitch, now + offset);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.45, now + offset + 0.04);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.8, now + offset + 0.08);
    osc.connect(envelope(ctx, now + offset, 0.06, 0.08));
    osc.start(now + offset);
    osc.stop(now + offset + 0.09);
  }
}

// A soft thump for a trash bag landing.
export function thump(strength = 1) {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
  osc.connect(envelope(ctx, now, Math.min(0.25, 0.08 * strength), 0.14));
  osc.start(now);
  osc.stop(now + 0.15);
}

// A garbage truck: filtered noise that swells and fades.
export function rumble(seconds = 3) {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 160;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35, now + seconds * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(now);
}

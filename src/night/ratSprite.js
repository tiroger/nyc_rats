// The atlas's rat, as canvas paths, for the Night shift's street life. The
// shapes are the same ones Rat.jsx draws (viewBox 240 x 140).
let paths = null;

function build() {
  paths = {
    tail: new Path2D("M51 99C-5 130 4 60 31 73C44 79 29 91 18 85"),
    body: new Path2D(
      "M46 90C44 54 77 32 114 42C142 44 167 57 181 77L213 93Q222 103 207 107L177 111H70Q47 108 46 90Z",
    ),
    ear: new Path2D("M129 65C108 41 125 15 146 27C160 35 157 51 153 62"),
    innerEar: new Path2D("M139 49C130 36 141 29 148 39"),
    // Two leg poses, alternated while running.
    legsA: new Path2D("m83 106-8 18h20m56-18 9 18h18"),
    legsB: new Path2D("m83 106 7 18h-13m60-18-8 18h-14"),
    whiskers: new Path2D("m201 98 27-13m-25 17 28 4m-34 0 23 15"),
  };
}

/**
 * Draw a rat standing on (x, y) with its feet, `width` pixels long.
 * dir: 1 faces right, -1 faces left. stride: running phase (any number).
 * bob: vertical bounce in px. sniff: 0..1 head dip. tail: tail swing angle.
 */
export function drawRat(ctx, x, y, width, { dir = 1, stride = 0, bob = 0, sniff = 0, tail = 0, color = "#0c0b09", rim = "#ffa53d", eye = "#ffe9a8" } = {}) {
  if (!paths) build();
  const s = width / 240;
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(dir * s, s);
  // Feet sit at y ≈ 124 in rat space; centre the body on x.
  ctx.translate(-130, -124);
  // Soft shadow on the ground.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(130, 126 + bob / s, 92, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Tail swings from its root.
  ctx.save();
  ctx.translate(49, 98);
  ctx.rotate(tail);
  ctx.translate(-49, -98);
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.stroke(paths.tail);
  ctx.restore();
  // Head dips when sniffing.
  ctx.save();
  ctx.translate(150, 80);
  ctx.rotate(sniff * 0.18);
  ctx.translate(-150, -80);
  ctx.fillStyle = color;
  ctx.fill(paths.body);
  ctx.fill(paths.ear);
  // Streetlight rim along the back.
  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.stroke(paths.ear);
  ctx.beginPath();
  ctx.moveTo(60, 70);
  ctx.bezierCurveTo(80, 45, 120, 38, 150, 48);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#3a2c22";
  ctx.lineWidth = 4;
  ctx.stroke(paths.innerEar);
  // Glinting eye and nose.
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(175, 80, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b4a3a";
  ctx.beginPath();
  ctx.arc(214, 97, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8c7a66";
  ctx.lineWidth = 2;
  ctx.stroke(paths.whiskers);
  ctx.restore();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.stroke(Math.floor(stride) % 2 ? paths.legsB : paths.legsA);
  ctx.restore();
}

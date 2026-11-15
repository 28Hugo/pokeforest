// Canvas port of the Mac's SafariParkPainting: one layout for every biome,
// palette, backdrop and props change per biome.
const W = 768, H = 448;
const POND = { x: 646, y: 292, rx: 98, ry: 74 };

const base = {
  groundTop: '#9ED37A', groundBottom: '#7CC064', speckLight: '#C4E89A', speckDark: '#5E9E4C', path: '#E9D3A0', pathEdge: '#C9AD74',
  liquidTop: '#7FD0F0', liquidBottom: '#3E95CF', shore: '#E6D9A6', dark: '#2F7A45', mid: '#47A05A', light: '#7CCB6B', trunk: '#7A5234', roof: '#D0573F',
  flowers: ['#FFF5C2', '#FFD34E', '#FF8FA8', '#FFFFFF'], border: 'broadleaf', backdrop: 'trees', liquid: 'water', grass: true, lily: true,
};
function palette(title) {
  const t = title.toLowerCase();
  if (t.includes('paldea')) return { ...base, groundTop: '#B5DB7C', groundBottom: '#93C865', roof: '#E0913A', flowers: ['#FFB347', '#FFE066', '#F4F1DE', '#E07A5F'] };
  if (t.includes('vertania') || t.includes('ewigwald') || t.includes('ewigenwald')) return { ...base, groundTop: '#76B35F', groundBottom: '#5A9A4B', speckLight: '#93CB72', speckDark: '#3F7B39', path: '#C9AE7C', pathEdge: '#9C8257', dark: '#1F5A35', mid: '#2F7D45', light: '#5CAE5A', roof: '#8F5B3A', flowers: ['#F3E8C8', '#E85D5D', '#FFF1A8'] };
  if (t.includes('schlummer')) return { ...base, groundTop: '#6D9E7E', groundBottom: '#557F68', speckLight: '#8DBB9B', speckDark: '#3E6452', path: '#B9B39A', pathEdge: '#8E8A73', liquidTop: '#7FB8C9', liquidBottom: '#3F7690', dark: '#1F4740', mid: '#2E6656', light: '#4F8B72', roof: '#5A6F8F', flowers: ['#C9D7F2', '#A7C5EB', '#FFFFFF'], fog: '#C8D8F0' };
  if (t.includes('route 14')) return { ...base, groundTop: '#9DB46A', groundBottom: '#7E9A55', speckLight: '#BACB86', speckDark: '#5F7A3F', path: '#B49B6B', pathEdge: '#8A7550', liquidTop: '#79A89A', liquidBottom: '#4D7B6C', shore: '#9C8A5A', liquid: 'murky', roof: '#6E7F4F', flowers: ['#D9C9F2', '#FFFFFF', '#F6D365'] };
  if (t.includes('küste')) return { ...base, groundTop: '#F4E2AE', groundBottom: '#EBD08F', speckLight: '#FFF4D0', speckDark: '#D7B979', path: '#C79A63', pathEdge: '#9E764A', liquidTop: '#6FE0E8', liquidBottom: '#2A9FD6', shore: '#FFF6DA', dark: '#2E8B57', mid: '#3FAF6A', light: '#7ED88B', trunk: '#A87B4F', roof: t.includes('alola') ? '#F28C38' : '#3B82C4', flowers: ['#FF7FA8', '#FFD166', '#FFFFFF'], border: 'palm', backdrop: 'sea', grass: false, lily: false };
  if (t.includes('silberberg')) return { ...base, groundTop: '#F4F8FC', groundBottom: '#DCE7F2', speckLight: '#FFFFFF', speckDark: '#BCCDE0', path: '#C9D3DE', pathEdge: '#A3B2C3', liquidTop: '#D7F1FA', liquidBottom: '#9CCDE6', shore: '#FFFFFF', dark: '#1F4D4A', mid: '#2E6B63', light: '#4E8F84', trunk: '#5C4433', roof: '#9B3B3B', flowers: ['#BFE3FF', '#FFFFFF'], border: 'pine', backdrop: 'snow', liquid: 'ice', grass: false, lily: false };
  if (t.includes('zinnober')) return { ...base, groundTop: '#6E5A55', groundBottom: '#54433F', speckLight: '#8C7670', speckDark: '#3E302D', path: '#9A8478', pathEdge: '#6F5D54', liquidTop: '#FFC24B', liquidBottom: '#E2471F', shore: '#3A2B28', dark: '#4A3B37', mid: '#6B5853', light: '#8F7A73', roof: '#3D3D46', flowers: ['#FF9F43', '#FFD166'], border: 'rock', backdrop: 'volcano', liquid: 'lava', grass: false, lily: false };
  if (t.includes('kraterberg')) return { ...base, groundTop: '#B8B2A6', groundBottom: '#9C968A', speckLight: '#D3CEC4', speckDark: '#7D776C', path: '#D8CDB4', pathEdge: '#ADA28A', liquidTop: '#8FC5DA', liquidBottom: '#4F87A8', shore: '#CFC8B8', dark: '#5F5A52', mid: '#7F786D', light: '#A59E92', roof: '#5B6B7F', flowers: ['#C7B8F5', '#FFFFFF'], border: 'rock', backdrop: 'cliffs', grass: false, lily: false };
  if (t.includes('himmel')) return { ...base, groundTop: '#D9E8F5', groundBottom: '#BCD3EA', speckLight: '#FFFFFF', speckDark: '#A5BED8', path: '#E9E1CC', pathEdge: '#C2B796', liquidTop: '#FFFFFF', liquidBottom: '#DDE9F7', shore: '#F5F9FF', dark: '#7C8DA6', mid: '#98A8BF', light: '#C3CFDF', roof: '#3E7D6B', flowers: ['#FFE9A8', '#FFFFFF'], border: 'rock', backdrop: 'clouds', liquid: 'cloud', grass: false, lily: false };
  return base;
}

function rng(seed) {
  let s = BigInt(seed) + 0x9E3779B97F4A7C15n;
  return () => {
    s = (s + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
    let z = s;
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & 0xFFFFFFFFFFFFFFFFn;
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & 0xFFFFFFFFFFFFFFFFn;
    z ^= z >> 31n;
    return Number(z >> 11n) / 2 ** 53;
  };
}

function pathRoute() {
  const p = new Path2D();
  p.moveTo(384, 86); p.bezierCurveTo(384, 150, 410, 190, 404, 232); p.bezierCurveTo(396, 300, 470, 380, 448, 460);
  p.moveTo(400, 214); p.bezierCurveTo(300, 250, 120, 236, -20, 262);
  p.moveTo(430, 330); p.bezierCurveTo(470, 318, 510, 330, 548, 318);
  return p;
}
function pond(inset = 0) {
  const p = new Path2D();
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const wob = 1 + 0.07 * Math.sin(t * 3 + 0.6) + 0.04 * Math.cos(t * 5);
    const x = POND.x + (POND.rx - inset) * Math.cos(t) * wob, y = POND.y + (POND.ry - inset) * Math.sin(t) * wob;
    i ? p.lineTo(x, y) : p.moveTo(x, y);
  }
  p.closePath();
  return p;
}

export function paint(canvas, biome, habitat = 1) {
  const ctx = canvas.getContext('2d');
  const scale = canvas.width / W;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const pal = palette(biome.title);
  const random = rng((biome.generation * 131 + habitat * 7919 + biome.requiredMinutes) | 0);
  const r = (a, b) => a + (b - a) * random();
  const route = pathRoute();
  const isFree = (x, y) => {
    const dx = (x - POND.x) / (POND.rx + 18), dy = (y - POND.y) / (POND.ry + 18);
    if (dx * dx + dy * dy < 1 || y < 100) return false;
    ctx.save(); ctx.lineWidth = 44; const on = ctx.isPointInStroke(route, x * scale, y * scale); ctx.restore();
    return !on;
  };
  // Ground
  let g = ctx.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, pal.groundTop); g.addColorStop(1, pal.groundBottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(200, 130, 0, 200, 130, 320); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 720; i++) {
    const x = r(0, W), y = r(90, H);
    ctx.strokeStyle = (random() > 0.5 ? pal.speckLight : pal.speckDark) + '8C'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (pal.border === 'palm' || pal.border === 'rock') ctx.ellipse(x, y, 1.2, 0.8, 0, 0, Math.PI * 2);
    else { ctx.moveTo(x, y); ctx.lineTo(x + r(-1.5, 1.5), y - r(3, 6)); }
    ctx.stroke();
  }
  backdrop(ctx, pal, r);
  // Path
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = pal.pathEdge; ctx.lineWidth = 36; ctx.stroke(route);
  ctx.strokeStyle = pal.path; ctx.lineWidth = 30; ctx.stroke(route);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 10; ctx.stroke(route);
  // Pond
  ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.save(); ctx.translate(0, 3); ctx.fill(pond(-10)); ctx.restore();
  ctx.fillStyle = pal.shore; ctx.fill(pond(-9));
  g = ctx.createLinearGradient(0, POND.y - POND.ry, 0, POND.y + POND.ry); g.addColorStop(0, pal.liquidTop); g.addColorStop(1, pal.liquidBottom);
  ctx.fillStyle = g; ctx.fill(pond());
  ctx.strokeStyle = pal.liquidBottom + '80'; ctx.lineWidth = 4; ctx.stroke(pond(3));
  if (pal.liquid === 'water' || pal.liquid === 'murky') {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) { const x = POND.x - 60 + r(0, 70), y = POND.y - 40 + i * 15; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y - 4, x + 30, y); ctx.stroke(); }
    if (pal.lily) for (const [dx, dy] of [[-54, 22], [40, -30], [58, 30]]) { ctx.fillStyle = '#3E9B4F'; ctx.beginPath(); ctx.moveTo(POND.x + dx, POND.y + dy); ctx.arc(POND.x + dx, POND.y + dy, 10, 0.35, Math.PI * 2 - 0.35); ctx.closePath(); ctx.fill(); }
  } else if (pal.liquid === 'lava') {
    ctx.fillStyle = 'rgba(255,227,138,0.85)'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.ellipse(POND.x + r(-70, 70), POND.y + r(-46, 46), 4, 3, 0, 0, Math.PI * 2); ctx.fill(); }
  } else if (pal.liquid === 'ice') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) { const x = POND.x + r(-60, 40), y = POND.y + r(-40, 30); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r(10, 30), y + r(-12, 12)); ctx.lineTo(x + r(30, 50), y + r(-8, 16)); ctx.stroke(); }
  } else {
    ctx.fillStyle = 'rgba(201,218,240,0.7)'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(POND.x + r(-70, 50) + 23, POND.y + r(-40, 30) + 11, 23, 11, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = pal.liquid === 'lava' ? '#3A2B28' : pal.liquid === 'ice' ? '#B7C6D6' : '#9C6B43';
  for (let i = 0; i < 4; i++) roundRect(ctx, POND.x - POND.rx - 14 + i * 12, POND.y + 14, 11, 30, 2);
  // Tall grass
  if (pal.grass) {
    for (const [px, py] of [[96, 300], [236, 404], [612, 128], [160, 168]]) {
      for (let i = 0; i < 26; i++) { const x = px + r(-52, 52), y = py + r(-26, 26); if (isFree(x, y)) tuft(ctx, x, y, pal.mid, pal.light, r(0.9, 1.3)); }
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = r(14, W - 14), y = r(110, H - 30);
    if (!isFree(x, y)) continue;
    if (random() < 0.18) stone(ctx, x, y, pal.border === 'rock' ? pal.mid : '#A8A29A', r(5, 9));
    else flower(ctx, x, y, pal.flowers[Math.floor(random() * pal.flowers.length) % pal.flowers.length]);
  }
  house(ctx, pal, biome.title.toLowerCase().includes('silberberg'));
  const props = [];
  for (let x = -10; x <= W + 10; x += 46) props.push([x + r(-8, 8), H - r(4, 16)]);
  for (let y = 130; y <= H - 40; y += 52) { props.push([r(-6, 12), y + r(-8, 8)]); props.push([W - r(-6, 12), y + r(-8, 8)]); }
  props.push([52, 128], [724, 138], [280, 132]);
  props.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => prop(ctx, pal, x, y, r(0.9, 1.2)));
  if (pal.fog) { ctx.fillStyle = pal.fog + '29'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(r(-200, 300) + 260, 163 + i * 62, 260, 23, 0, 0, Math.PI * 2); ctx.fill(); } }
  g = ctx.createRadialGradient(W / 2, H / 2, W * 0.38, W / 2, H / 2, W * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function roundRect(ctx, x, y, w, h, radius) { ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill(); }
function canopy(ctx, cx, cy, rad, pal) {
  for (const [bx, by] of [[-0.45, 0.15], [0.45, 0.15], [0, -0.3], [0, 0.2]]) {
    const x = cx + bx * rad, y = cy + by * rad;
    const g = ctx.createRadialGradient(x - rad * 0.25, y - rad * 0.3, 1, x, y, rad * 1.1);
    g.addColorStop(0, pal.light); g.addColorStop(0.5, pal.mid); g.addColorStop(1, pal.dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad * 0.7, 0, Math.PI * 2); ctx.fill();
  }
}
function backdrop(ctx, pal, r) {
  if (pal.backdrop === 'trees') {
    ctx.fillStyle = pal.dark; ctx.fillRect(0, 0, W, 70);
    for (let x = -20; x < W + 20; x += r(28, 40)) canopy(ctx, x, r(46, 64), r(26, 38), pal);
  } else if (pal.backdrop === 'sea') {
    const g = ctx.createLinearGradient(0, 0, 0, 92); g.addColorStop(0, pal.liquidBottom); g.addColorStop(1, pal.liquidTop);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 84);
    for (let x = W; x >= 0; x -= 24) ctx.lineTo(x, 84 + Math.sin(x / 40) * 8);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = pal.shore; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) { const x = r(0, W), y = r(12, 70); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 4, x + 16, y); ctx.stroke(); }
  } else if (pal.backdrop === 'clouds') {
    const g = ctx.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, '#8DB8E8'); g.addColorStop(1, '#D3E5F7');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 100);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; for (let i = 0; i < 22; i++) { ctx.beginPath(); ctx.ellipse(r(-20, W + 20), r(40, 98), 40, 18, 0, 0, Math.PI * 2); ctx.fill(); }
    for (const x of [120, 250, 520, 650]) { ctx.fillStyle = '#C9D4E2'; roundRect(ctx, x, 20, 16, 72, 3); ctx.fillStyle = '#AEBBCD'; ctx.fillRect(x - 4, 16, 24, 7); }
  } else {
    const volcano = pal.backdrop === 'volcano';
    const g = ctx.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, volcano ? '#5A3A3A' : '#BFD9F2'); g.addColorStop(1, volcano ? '#8E4B32' : '#E6F0FA');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 96);
    const ridge = new Path2D(); ridge.moveTo(0, 96);
    for (let x = 0; x <= W + 60; x += 80) { ridge.lineTo(x, r(14, 54)); ridge.lineTo(x + 40, r(60, 84)); }
    ridge.lineTo(W, 100); ridge.lineTo(0, 100); ridge.closePath();
    const rg = ctx.createLinearGradient(0, 0, 0, 100); rg.addColorStop(0, pal.light); rg.addColorStop(1, pal.dark);
    ctx.fillStyle = rg; ctx.fill(ridge);
    if (pal.backdrop === 'snow') { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 46); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(ridge); ctx.restore(); }
    if (volcano) { ctx.fillStyle = 'rgba(128,128,128,0.35)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(540 + i * 22, 19 - i * 4, 20, 11, 0, 0, Math.PI * 2); ctx.fill(); } }
  }
}
function house(ctx, pal, snow) {
  const x = 340, y = 30, w = 88, h = 58;
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x + w / 2 + 4, y + h + 2, w / 2 + 10, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal.border === 'rock' ? '#C7C2B8' : '#F4E7C8'; roundRect(ctx, x, y, w, h, 4);
  const g = ctx.createLinearGradient(0, y - 26, 0, y + 4); g.addColorStop(0, pal.roof + 'D9'); g.addColorStop(1, pal.roof);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 10, y + 4); ctx.lineTo(x + w / 2, y - 26); ctx.lineTo(x + w + 10, y + 4); ctx.closePath(); ctx.fill();
  if (snow) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + w / 2, y - 24); ctx.lineTo(x + w + 6, y); ctx.stroke(); }
  ctx.fillStyle = '#6B4428'; roundRect(ctx, x + w / 2 - 9, y + h - 26, 18, 26, 3);
  for (const wx of [x + 10, x + w - 28]) { ctx.fillStyle = '#9ED8F0'; roundRect(ctx, wx, y + 14, 18, 14, 2); ctx.strokeStyle = '#6B4428'; ctx.lineWidth = 2; ctx.strokeRect(wx, y + 14, 18, 14); }
  ctx.strokeStyle = '#A06C42'; ctx.lineWidth = 3;
  for (const side of [-1, 1]) { for (const ry of [76, 83]) { ctx.beginPath(); ctx.moveTo(x + w / 2 + side * 62, ry); ctx.lineTo(x + w / 2 + side * 110, ry); ctx.stroke(); } }
}
function prop(ctx, pal, x, y, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, 22 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
  if (pal.border === 'broadleaf') { ctx.fillStyle = pal.trunk; roundRect(ctx, x - 4 * s, y - 22 * s, 8 * s, 22 * s, 2); canopy(ctx, x, y - 38 * s, 24 * s, pal); }
  else if (pal.border === 'pine') {
    ctx.fillStyle = pal.trunk; ctx.fillRect(x - 3 * s, y - 14 * s, 6 * s, 14 * s);
    for (let tier = 0; tier < 3; tier++) {
      const w = (40 - tier * 9) * s, top = y - (30 + tier * 16) * s;
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, pal.light); g.addColorStop(1, pal.dark);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, top - 14 * s); ctx.lineTo(x + w / 2, top + 16 * s); ctx.lineTo(x - w / 2, top + 16 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.moveTo(x, top - 14 * s); ctx.lineTo(x + w / 5, top - 4 * s); ctx.lineTo(x - w / 5, top - 4 * s); ctx.closePath(); ctx.fill();
    }
  } else if (pal.border === 'palm') {
    ctx.strokeStyle = pal.trunk; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 8 * s, y - 30 * s, x + 10 * s, y - 54 * s); ctx.stroke();
    const tx = x + 10 * s, ty = y - 54 * s;
    for (let a = -160; a <= 20; a += 36) {
      const rad = (a * Math.PI) / 180, ex = tx + Math.cos(rad) * 30 * s, ey = ty + Math.sin(rad) * 18 * s + 8 * s;
      ctx.strokeStyle = pal.mid; ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo((tx + ex) / 2, Math.min(ty, ey) - 12 * s, ex, ey); ctx.stroke();
    }
  } else { stone(ctx, x, y - 14 * s, pal.mid, 30 * s); stone(ctx, x + 16 * s, y - 6 * s, pal.light, 16 * s); }
}
function stone(ctx, x, y, color, size) {
  ctx.fillStyle = color; roundRect(ctx, x - size / 2, y - size * 0.4, size, size * 0.8, size * 0.35);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x - size * 0.15, y - size * 0.2, size * 0.15, size * 0.09, 0, 0, Math.PI * 2); ctx.fill();
}
function tuft(ctx, x, y, dark, light, s) {
  for (const [o, c] of [[-5, dark], [0, light], [5, dark]]) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + o * s - 3 * s, y);
    ctx.quadraticCurveTo(x + o * s - 2 * s, y - 9 * s, x + o * s * 1.4, y - 16 * s);
    ctx.quadraticCurveTo(x + o * s + 2 * s, y - 8 * s, x + o * s + 3 * s, y); ctx.closePath(); ctx.fill();
  }
}
function flower(ctx, x, y, color) {
  ctx.fillStyle = color;
  for (let a = 0; a < 360; a += 72) { const rad = (a * Math.PI) / 180; ctx.beginPath(); ctx.arc(x + Math.cos(rad) * 2.6, y + Math.sin(rad) * 2.6, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#F2A93B'; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
}
export const SIZE = { W, H };

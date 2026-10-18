// Share cards: 1080×1920 story images (Instagram / WhatsApp stories), drawn on the
// visitor's device. Three built-in styles, plus any ready-made cards uploaded in the editor.
// Nothing is uploaded anywhere.

export type CardStyle = 'vinyl' | 'sleeve' | 'liner';

export interface CardData {
  slug: string;
  title: string;
  artist: string;
  year: number;
  issue: number;
  accent: string;
  onAccent: string;
  siteName: string;
  cover: string;  // image URL, or '' when the album has no cover
  quote: string;  // text for the liner-notes card
  tracks: { n: string; title: string; time: string }[];
  customCards: { label: string; url: string }[];
  labels: { kicker: string; issue: string; liner: string; score: string; yourTurn: string };
}

const W = 1080;
const H = 1920;
const INK = '#0E1116';
const PAPER = '#ECE6DA';
const MUTED = '#A3ACB8';
const DISPLAY = '"Bricolage Grotesque Variable", system-ui, sans-serif';
const SERIF = '"Newsreader Variable", Georgia, serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const M = 88; // page margin

/* ---------- helpers ---------- */

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Fit a title into at most `maxLines` lines by stepping the font size down. */
function fitTitle(ctx: CanvasRenderingContext2D, text: string, start: number, min: number, maxWidth: number, maxLines: number) {
  let size = start;
  ctx.font = `800 ${size}px ${DISPLAY}`;
  let lines = wrap(ctx, text, maxWidth);
  while (lines.length > maxLines && size > min) {
    size -= 8;
    ctx.font = `800 ${size}px ${DISPLAY}`;
    lines = wrap(ctx, text, maxWidth);
  }
  return { size, lines };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function record(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string) {
  ctx.fillStyle = '#0A0A0B';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1B1D20';
  ctx.lineWidth = 1.5;
  for (let g = r * 0.37; g < r - 6; g += 6) { ctx.beginPath(); ctx.arc(cx, cy, g, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(6, r * 0.02), 0, Math.PI * 2); ctx.fill();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Draw an image cropped to fill a square, like CSS object-fit: cover. */
function coverSquare(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - s) / 2;
  const sy = (img.naturalHeight - s) / 2;
  ctx.drawImage(img, sx, sy, s, s, x, y, size, size);
}

function header(ctx: CanvasRenderingContext2D, d: CardData, color: string, accent: string) {
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.font = `800 40px ${DISPLAY}`;
  ctx.fillText(d.siteName, M, 150);
  ctx.fillStyle = accent;
  ctx.font = `400 28px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(`Nº ${d.issue}`, W - M, 150);
  ctx.textAlign = 'left';
}

function footer(ctx: CanvasRenderingContext2D, d: CardData, color: string) {
  ctx.fillStyle = color;
  ctx.font = `400 28px ${MONO}`;
  ctx.fillText(`${d.labels.yourTurn} ${location.host}`, M, H - 90);
}

function scoreBox(ctx: CanvasRenderingContext2D, d: CardData, score: string, y: number, bg: string, fg: string) {
  ctx.fillStyle = bg;
  roundRect(ctx, M, y, W - 2 * M, 220, 36);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `400 26px ${MONO}`;
  ctx.fillText(d.labels.score, M + 40, y + 62);
  ctx.font = `800 110px ${DISPLAY}`;
  ctx.fillText(score, M + 40, y + 182);
}

/* ---------- style 1: Vinyl (dark, record half off the edge) ---------- */

function drawVinyl(ctx: CanvasRenderingContext2D, d: CardData, score: string | null) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  record(ctx, 880, 1000, 500, d.accent);
  header(ctx, d, PAPER, d.accent);

  let y = 560;
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${MONO}`;
  ctx.fillText(d.labels.kicker, M, y);

  ctx.fillStyle = PAPER;
  const { size, lines } = fitTitle(ctx, d.title, 168, 96, W - 2 * M, 3);
  y += size * 1.05;
  for (const line of lines) { ctx.fillText(line, M, y); y += size * 0.9; }
  ctx.font = `600 56px ${DISPLAY}`;
  ctx.fillText(`${d.artist} · ${d.year}`, M, y - size * 0.9 + 100);

  if (score) scoreBox(ctx, d, score, 1500, d.accent, d.onAccent);
  footer(ctx, d, MUTED);
}

/* ---------- style 2: Sleeve (accent colour, cover with the record sliding out) ---------- */

async function drawSleeve(ctx: CanvasRenderingContext2D, d: CardData, score: string | null) {
  ctx.fillStyle = d.accent;
  ctx.fillRect(0, 0, W, H);
  header(ctx, d, d.onAccent, d.onAccent);

  const size = 720;
  const x = M;
  const y = 300;
  record(ctx, x + size * 0.86, y + size / 2, size * 0.46, PAPER);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, size, size);
  ctx.restore();

  const img = await loadImage(d.cover);
  if (img) coverSquare(ctx, img, x, y, size);
  else {
    // No cover uploaded: a typographic sleeve, like the one on the site.
    const t = fitTitle(ctx, d.title, 110, 60, size - 112, 2);
    const firstLine = y + size - 64 - (t.lines.length - 1) * t.size * 0.9;
    ctx.fillStyle = PAPER;
    let ty = firstLine;
    for (const line of t.lines) { ctx.fillText(line, x + 56, ty); ty += t.size * 0.9; }
    ctx.font = `600 40px ${DISPLAY}`;
    ctx.fillText(d.artist, x + 56, firstLine - t.size * 0.95);
  }

  let ty = y + size + 150;
  ctx.fillStyle = d.onAccent;
  ctx.font = `400 28px ${MONO}`;
  ctx.fillText(d.labels.issue, M, ty);
  const t = fitTitle(ctx, d.title, 120, 72, W - 2 * M, 2);
  ty += t.size * 1.05;
  for (const line of t.lines) { ctx.fillText(line, M, ty); ty += t.size * 0.9; }
  ctx.font = `600 50px ${DISPLAY}`;
  ctx.fillText(`${d.artist} · ${d.year}`, M, ty - t.size * 0.9 + 84);

  if (score) scoreBox(ctx, d, score, 1520, INK, PAPER);
  footer(ctx, d, d.onAccent);
}

/* ---------- style 3: Liner notes (paper, quote and tracklist) ---------- */

function drawLiner(ctx: CanvasRenderingContext2D, d: CardData, score: string | null) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = d.accent;
  ctx.fillRect(0, 0, W, 28);
  header(ctx, d, INK, INK);

  let y = 330;
  ctx.fillStyle = '#5B6470';
  ctx.font = `400 30px ${MONO}`;
  ctx.fillText(d.labels.liner, M, y);

  ctx.fillStyle = INK;
  const t = fitTitle(ctx, d.title, 140, 80, W - 2 * M, 2);
  y += t.size * 1.05;
  for (const line of t.lines) { ctx.fillText(line, M, y); y += t.size * 0.9; }
  ctx.font = `600 50px ${DISPLAY}`;
  y = y - t.size * 0.9 + 86;
  ctx.fillText(`${d.artist} · ${d.year}`, M, y);

  y += 60;
  ctx.fillStyle = INK;
  ctx.fillRect(M, y, W - 2 * M, 3);

  if (d.quote) {
    y += 100;
    ctx.font = `italic 400 50px ${SERIF}`;
    let lines = wrap(ctx, `“${d.quote}”`, W - 2 * M);
    if (lines.length > 7) {
      lines = lines.slice(0, 7);
      lines[6] = lines[6].replace(/\s*\S*$/, '…”');
    }
    for (const line of lines) { ctx.fillText(line, M, y); y += 66; }
  }

  const listTop = score ? 1330 : 1500;
  const rows = d.tracks.slice(0, score ? 4 : 6);
  ctx.font = `400 28px ${MONO}`;
  let ry = Math.max(y + 60, listTop);
  for (const tr of rows) {
    if (ry > H - 260) break;
    ctx.fillStyle = '#5B6470';
    ctx.fillText(tr.n, M, ry);
    ctx.fillStyle = INK;
    const title = tr.title.length > 32 ? `${tr.title.slice(0, 31)}…` : tr.title;
    ctx.fillText(title, M + 90, ry);
    ctx.textAlign = 'right';
    ctx.fillText(tr.time, W - M, ry);
    ctx.textAlign = 'left';
    ry += 46;
  }

  if (score) {
    // The pill grows with the text, so longer labels (e.g. Italian) still fit.
    const label = `${d.labels.score} ${score}`;
    ctx.font = `600 40px ${DISPLAY}`;
    const w = Math.min(W - 2 * M, ctx.measureText(label).width + 80);
    ctx.fillStyle = d.accent;
    roundRect(ctx, M, H - 330, w, 110, 55);
    ctx.fill();
    ctx.fillStyle = d.onAccent;
    ctx.fillText(label, M + 40, H - 262);
  }
  footer(ctx, d, '#5B6470');
}

/* ---------- public API ---------- */

let fontsReady: Promise<unknown> | null = null;
function loadFonts() {
  fontsReady ??= Promise.all([
    document.fonts.load(`800 160px ${DISPLAY}`),
    document.fonts.load(`600 56px ${DISPLAY}`),
    document.fonts.load(`italic 400 50px ${SERIF}`),
    document.fonts.load(`400 30px ${MONO}`),
  ]).catch(() => undefined);
  return fontsReady;
}

export async function drawCard(style: CardStyle, d: CardData, score: string | null): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  if (style === 'vinyl') drawVinyl(ctx, d, score);
  else if (style === 'sleeve') await drawSleeve(ctx, d, score);
  else drawLiner(ctx, d, score);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'),
  );
}

export async function customCard(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return res.blob();
}

export function canShareFiles(): boolean {
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'card.png', { type: 'image/png' });
    return Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

export async function share(blob: Blob, name: string, title: string) {
  const file = new File([blob], name, { type: blob.type || 'image/png' });
  try {
    await navigator.share({ files: [file], title });
  } catch (err) {
    if ((err as DOMException).name !== 'AbortError') download(blob, name);
  }
}

export function download(blob: Blob, name: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

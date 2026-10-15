// Draws a 1080×1920 story image (Instagram / WhatsApp stories) on the visitor's device,
// then opens the phone's share sheet, or downloads the image on a computer.
// Nothing is uploaded anywhere.

export interface CardData {
  slug: string;
  title: string;
  artist: string;
  year: number;
  issue: number;
  accent: string;
  onAccent: string;
  siteName: string;
  labels: { kicker: string; score: string; yourTurn: string };
}

const W = 1080;
const H = 1920;
const INK = '#0E1116';
const PAPER = '#ECE6DA';
const MUTED = '#A3ACB8';
const DISPLAY = '"Bricolage Grotesque Variable", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
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

export async function drawCard(data: CardData, score: string | null): Promise<Blob> {
  // Make sure the site's fonts are ready before drawing with them.
  await Promise.all([
    document.fonts.load(`800 160px ${DISPLAY}`),
    document.fonts.load(`600 56px ${DISPLAY}`),
    document.fonts.load(`400 30px ${MONO}`),
  ]).catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  // The record, half off the right edge.
  const cx = 880, cy = 1000, r = 500;
  ctx.fillStyle = '#0A0A0B';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1B1D20';
  ctx.lineWidth = 1.5;
  for (let g = 185; g < r - 6; g += 6) { ctx.beginPath(); ctx.arc(cx, cy, g, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = data.accent;
  ctx.beginPath(); ctx.arc(cx, cy, 170, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();

  // Header
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAPER;
  ctx.font = `800 40px ${DISPLAY}`;
  ctx.fillText(data.siteName, 88, 150);
  ctx.fillStyle = data.accent;
  ctx.font = `400 28px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText(`Nº ${data.issue}`, W - 88, 150);
  ctx.textAlign = 'left';

  // Title block
  let y = 560;
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${MONO}`;
  ctx.fillText(data.labels.kicker, 88, y);

  ctx.fillStyle = PAPER;
  let size = 168;
  ctx.font = `800 ${size}px ${DISPLAY}`;
  let lines = wrap(ctx, data.title, W - 176);
  while (lines.length > 3 && size > 96) { // long titles get smaller type
    size -= 12;
    ctx.font = `800 ${size}px ${DISPLAY}`;
    lines = wrap(ctx, data.title, W - 176);
  }
  y += size * 1.05;
  for (const line of lines) { ctx.fillText(line, 88, y); y += size * 0.9; }

  ctx.font = `600 56px ${DISPLAY}`;
  ctx.fillText(`${data.artist} · ${data.year}`, 88, y - size * 0.9 + 100);

  // Quiz score, when the visitor took the quiz
  if (score) {
    const boxY = 1480;
    ctx.fillStyle = data.accent;
    roundRect(ctx, 88, boxY, W - 176, 240, 36);
    ctx.fill();
    ctx.fillStyle = data.onAccent;
    ctx.font = `400 26px ${MONO}`;
    ctx.fillText(data.labels.score, 128, boxY + 66);
    ctx.font = `800 120px ${DISPLAY}`;
    ctx.fillText(score, 128, boxY + 196);
  }

  ctx.fillStyle = MUTED;
  ctx.font = `400 28px ${MONO}`;
  ctx.fillText(`${data.labels.yourTurn} ${location.host}`, 88, H - 90);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'),
  );
}

export async function shareCard(data: CardData, score: string | null) {
  const blob = await drawCard(data, score);
  const file = new File([blob], `${data.slug}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${data.title} · ${data.artist}` });
      return;
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return; // visitor closed the share sheet
    }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

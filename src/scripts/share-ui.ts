import { canShareFiles, customCard, download, drawCard, share, type CardData, type CardStyle } from './share-card';

/* Builds the swipeable rows of share cards. The same row is used twice on the album page:
   inside the "Share this album" window and in the "Take it with you" section under the quiz.
   Both rows share one image cache, so each card is only drawn once per score. */

export interface ShareSetup {
  card: CardData;
  cardStyles: { id: CardStyle; label: string }[];
  labels: { share: string; download: string };
}

type Option = { key: string; label: string; make: (score: string | null) => Promise<Blob> };

const cache = new Map<string, Promise<Blob>>();

export function quizScore(slug: string): string | null {
  try { return sessionStorage.getItem(`quiz:${slug}`); } catch { return null; }
}

export function createCardRow(setup: ShareSetup, track: HTMLElement, dots: HTMLElement | null, getScore: () => string | null) {
  const { card, cardStyles, labels } = setup;
  const canShare = canShareFiles();
  const options: Option[] = [
    ...cardStyles.map((st) => ({ key: st.id, label: st.label, make: (score: string | null) => drawCard(st.id, card, score) })),
    ...card.customCards.map((c, i) => ({ key: `custom-${i}`, label: c.label, make: () => customCard(c.url) })),
  ];
  const blobFor = (o: Option) => {
    const score = getScore();
    const key = o.key.startsWith('custom') ? o.key : `${o.key}|${score ?? ''}`;
    if (!cache.has(key)) cache.set(key, o.make(score));
    return cache.get(key)!;
  };
  const fileName = (o: Option, blob: Blob) => {
    const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
    return `${card.slug}-${o.key}.${ext}`;
  };

  const slides: HTMLElement[] = [];
  for (const o of options) {
    const slide = document.createElement('div');
    slide.className = 'share-slide';
    slide.setAttribute('role', 'listitem');
    slide.dataset.key = o.key;
    slide.innerHTML = '<div class="share-thumb"></div><p class="share-slide-name"></p><div class="share-slide-actions"></div>';
    slide.querySelector('.share-slide-name')!.textContent = o.label;
    const actions = slide.querySelector('.share-slide-actions')!;
    const makeButton = (text: string, primary: boolean, run: (blob: Blob, name: string) => Promise<void> | void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = primary ? 'btn btn--primary' : 'btn';
      b.textContent = text;
      b.setAttribute('aria-label', `${text}: ${o.label}`);
      b.addEventListener('click', async () => {
        b.disabled = true;
        try { const blob = await blobFor(o); await run(blob, fileName(o, blob)); }
        finally { b.disabled = false; }
      });
      actions.appendChild(b);
    };
    if (canShare) makeButton(labels.share, true, (blob, name) => share(blob, name, `${card.title} · ${card.artist}`));
    makeButton(labels.download, !canShare, (blob, name) => download(blob, name));
    track.appendChild(slide);
    slides.push(slide);
    dots?.appendChild(document.createElement('span'));
  }

  // The card in view gets its dot lit and the "is-on" class (the strip uses it to bring that card forward).
  const dotEls = dots ? [...dots.querySelectorAll('span')] : [];
  let current = 0;
  const setCurrent = (i: number) => {
    current = i;
    slides.forEach((s, n) => s.classList.toggle('is-on', n === i));
    dotEls.forEach((d, n) => d.classList.toggle('is-on', n === i));
  };
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) setCurrent(slides.indexOf(e.target as HTMLElement));
  }, { root: track, threshold: 0.6 });
  slides.forEach((s) => observer.observe(s));
  setCurrent(0);

  let drawn = false;
  const render = async () => {
    drawn = true;
    for (const o of options) {
      const thumb = track.querySelector(`.share-slide[data-key="${o.key}"] .share-thumb`)!;
      try {
        const blob = await blobFor(o);
        const img = document.createElement('img');
        img.alt = o.label;
        img.src = URL.createObjectURL(blob);
        thumb.replaceChildren(img);
      } catch {
        thumb.textContent = '–';
      }
    }
  };

  const go = (step: number) => {
    const target = slides[Math.max(0, Math.min(slides.length - 1, current + step))];
    if (!target) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
  };

  return { render, go, get drawn() { return drawn; }, count: slides.length };
}

import { controllable, player, type PlayerConfig, type Source } from './player';
import { canShareFiles, customCard, download, drawCard, share, type CardData, type CardStyle } from './share-card';

interface TrackInfo { side: string; title: string; time: string; note: string }
interface PageData {
  player: PlayerConfig;
  sources: Source[];
  tracks: TrackInfo[];
  labels: { play: string; pause: string; side: string; ytError: string; ytOpen: string };
  card: CardData;
  cardStyles: { id: CardStyle; label: string }[];
}

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

const dataEl = $('#page-data');
if (dataEl) init(JSON.parse(dataEl.textContent || '{}') as PageData);

function init(data: PageData) {
  const total = data.tracks.length;
  if (data.sources.length) player.init({ ...data.player, messages: { ytError: data.labels.ytError, ytOpen: data.labels.ytOpen } }, data.sources[0]);

  /* ----- Play / pause buttons (hero + listening mode) ----- */
  for (const btn of $$<HTMLButtonElement>('[data-action="toggle-play"]')) {
    btn.addEventListener('click', () => player.toggle());
  }
  player.events.addEventListener('state', () => {
    for (const btn of $$<HTMLButtonElement>('[data-action="toggle-play"]')) {
      btn.setAttribute('aria-pressed', String(player.playing));
      const label = $('[data-play-label]', btn);
      if (label) label.textContent = player.playing ? data.labels.pause : data.labels.play;
      else btn.setAttribute('aria-label', player.playing ? data.labels.pause : data.labels.play);
      $$('[data-icon]', btn).forEach((icon) => (icon.hidden = icon.dataset.icon !== (player.playing ? 'pause' : 'play')));
    }
    if (player.playing) pauseIntro();
  });

  /* ----- Source tabs ----- */
  const showSource = (which: Source) => {
    for (const tab of $$<HTMLButtonElement>('[data-source-tab]')) tab.setAttribute('aria-pressed', String(tab.dataset.sourceTab === which));
    for (const frame of $$('[data-for]')) frame.hidden = frame.dataset.for !== which;
    for (const s of $$('[data-slot]')) s.classList.toggle('is-active', s.dataset.slot === which);
    // Apple Music and Amazon Music use their own controls, so the page's play buttons step aside.
    const ours = controllable(which);
    for (const el of $$('[data-action="toggle-play"], [data-play-track]')) el.hidden = !ours;
    for (const el of $$('[data-time-only]')) el.hidden = ours;
  };
  if (data.sources.length) showSource(data.sources[0]);
  for (const tab of $$<HTMLButtonElement>('[data-source-tab]')) {
    tab.addEventListener('click', () => {
      const which = tab.dataset.sourceTab as Source;
      player.setSource(which);
      showSource(which);
    });
  }
  for (const btn of $$<HTMLButtonElement>('[data-action="load-player"]')) {
    btn.addEventListener('click', () => player.load(btn.dataset.source as Source));
  }

  /* ----- Record sides ----- */
  const sidesRoot = $('[data-sides]');
  const sides = sidesRoot ? $$('[data-side-panel]', sidesRoot).map((p) => p.dataset.sidePanel!) : [];
  let currentSide = sides[0];
  const showSide = (side: string) => {
    if (!sidesRoot || !sides.includes(side)) return;
    currentSide = side;
    for (const p of $$('[data-side-panel]', sidesRoot)) p.hidden = p.dataset.sidePanel !== side;
    for (const tab of $$<HTMLButtonElement>('[data-side-tab]', sidesRoot)) tab.setAttribute('aria-pressed', String(tab.dataset.sideTab === side));
    for (const el of $$('[data-side-label]')) el.textContent = side;
    const heading = $('[data-side-heading]', sidesRoot);
    if (heading) heading.textContent = `${data.labels.side} ${side}`;
    const flip = $('[data-flip-to]', sidesRoot);
    if (flip) flip.textContent = sides[(sides.indexOf(side) + 1) % sides.length];
  };
  if (sides.length > 1) {
    showSide(currentSide);
    for (const tab of $$<HTMLButtonElement>('[data-side-tab]')) tab.addEventListener('click', () => showSide(tab.dataset.sideTab!));
    $('[data-action="flip"]')?.addEventListener('click', () => showSide(sides[(sides.indexOf(currentSide) + 1) % sides.length]));
  }

  /* ----- Per-track play buttons ----- */
  for (const btn of $$<HTMLButtonElement>('[data-play-track]')) {
    btn.addEventListener('click', async () => {
      const index = Number(btn.dataset.playTrack);
      await player.load();
      // Spotify's embed can't jump to a track, so it simply starts the album.
      if (!player.playTrack(index) && !player.playing) await player.toggle();
    });
  }

  /* ----- Track changes: highlight list, switch side, update listening mode ----- */
  const renderTrack = (index: number) => {
    const t = data.tracks[index];
    if (!t) return;
    for (const li of $$('[data-track-index]')) li.classList.toggle('is-current', Number(li.dataset.trackIndex) === index);
    if (t.side !== currentSide) showSide(t.side);
    const set = (sel: string, text: string) => { const el = $(sel); if (el) el.textContent = text; };
    set('[data-listen="n"]', String(index + 1));
    set('[data-listen="title"]', t.title);
    set('[data-listen="note"]', t.note);
    set('[data-listen="time"]', t.time);
    for (const el of $$('[data-side-label]')) el.textContent = t.side;
  };
  player.events.addEventListener('track', (e) => renderTrack((e as CustomEvent<{ index: number }>).detail.index));

  /* ----- Listening mode ----- */
  const overlay = $('[data-listening]');
  let opener: HTMLElement | null = null;
  const closeListening = () => {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.documentElement.classList.remove('listening-open');
    opener?.focus();
  };
  for (const btn of $$('[data-action="open-listening"]')) {
    btn.addEventListener('click', () => {
      if (!overlay) return;
      opener = btn;
      renderTrack(player.track);
      overlay.hidden = false;
      document.documentElement.classList.add('listening-open');
      $<HTMLElement>('[data-action="close-listening"]', overlay)?.focus();
    });
  }
  overlay?.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeListening(); });
  $('[data-action="close-listening"]')?.addEventListener('click', closeListening);
  $('[data-action="next"]')?.addEventListener('click', () => player.next(total));
  $('[data-action="prev"]')?.addEventListener('click', () => player.prev(total));

  /* ----- Spoken intro ----- */
  const introBtn = $<HTMLButtonElement>('[data-intro]');
  const introAudio = $<HTMLAudioElement>('[data-intro-audio]');
  function pauseIntro() { introAudio?.pause(); }
  if (introBtn && introAudio) {
    introBtn.addEventListener('click', () => {
      if (introAudio.paused) { player.pause(); introAudio.play(); } else introAudio.pause();
    });
    const sync = () => {
      const on = !introAudio.paused;
      introBtn.setAttribute('aria-pressed', String(on));
      $$('[data-icon]', introBtn).forEach((icon) => (icon.hidden = icon.dataset.icon !== (on ? 'pause' : 'play')));
    };
    introAudio.addEventListener('play', sync);
    introAudio.addEventListener('pause', sync);
  }

  initQuiz();
  initArchiveFilters();

  initShare(data);
}

/* ---------- Quiz: one question at a time, score at the end ---------- */
function initQuiz() {
  const root = $('[data-quiz]');
  if (!root) return;
  const questions = $$('[data-q]', root);
  const result = $('[data-quiz-result]', root);
  let score = 0;

  const show = (i: number) => questions.forEach((q, n) => (q.hidden = n !== i));

  questions.forEach((q, i) => {
    const opts = $$<HTMLButtonElement>('[data-opt]', q);
    const feedback = $('[data-feedback]', q)!;
    opts.forEach((opt) => {
      opt.addEventListener('click', () => {
        const right = opt.dataset.correct === 'true';
        if (right) score++;
        opts.forEach((o) => {
          o.disabled = true;
          if (o.dataset.correct === 'true') o.classList.add('is-correct');
        });
        if (!right) opt.classList.add('is-wrong');
        $('[data-verdict]', feedback)!.textContent = right ? feedback.dataset.right! : feedback.dataset.wrong!;
        feedback.hidden = false;
        $<HTMLElement>('[data-next]', feedback)?.focus();
      });
    });
    $('[data-next]', q)?.addEventListener('click', () => {
      if (i + 1 < questions.length) {
        show(i + 1);
        $<HTMLElement>('[data-opt]', questions[i + 1])?.focus();
      } else {
        questions.forEach((x) => (x.hidden = true));
        $('[data-score]', result!)!.textContent = `${score}/${questions.length}`;
        result!.hidden = false;
        try { sessionStorage.setItem(`quiz:${root.dataset.quiz}`, `${score}/${questions.length}`); } catch { /* storage unavailable */ }
      }
    });
  });

  $('[data-retry]', root)?.addEventListener('click', () => {
    score = 0;
    for (const q of questions) {
      $('[data-feedback]', q)!.hidden = true;
      for (const o of $$<HTMLButtonElement>('[data-opt]', q)) {
        o.disabled = false;
        o.classList.remove('is-correct', 'is-wrong');
      }
    }
    result!.hidden = true;
    show(0);
  });
}

/* ---------- Archive filters ---------- */
function initArchiveFilters() {
  const root = $('[data-archive]');
  if (!root) return;
  const tiles = $$('[data-tile]', root);
  const empty = $('[data-archive-empty]', root);
  const buttons = $$<HTMLButtonElement>('[data-filter]', root);
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const [key, value] = (btn.dataset.filter || '').split(':');
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      let shown = 0;
      for (const tile of tiles) {
        const match = !value || tile.dataset[key] === value;
        tile.hidden = !match;
        if (match) shown++;
      }
      if (empty) empty.hidden = shown > 0;
    });
  }
}

/* ---------- Share dialog: pick a card, then share or download it ---------- */
function initShare(data: PageData) {
  const dialog = $('[data-share-dialog]');
  const optionsEl = dialog && $('[data-share-options]', dialog);
  if (!dialog || !optionsEl) return;
  const scoreRow = $('[data-share-score]', dialog)!;
  const scoreBox = $<HTMLInputElement>('[data-share-include-score]', dialog)!;
  const shareBtn = $<HTMLButtonElement>('[data-action="do-share"]', dialog)!;
  const downloadBtn = $<HTMLButtonElement>('[data-action="do-download"]', dialog)!;
  shareBtn.hidden = !canShareFiles();

  type Option = { key: string; label: string; make: () => Promise<Blob> };
  let score: string | null = null;
  let selected = 'vinyl';
  let opener: HTMLElement | null = null;
  const cache = new Map<string, Promise<Blob>>();
  const currentScore = () => (score && scoreBox.checked ? score : null);

  const options: Option[] = [
    ...data.cardStyles.map((s) => ({
      key: s.id,
      label: s.label,
      make: () => drawCard(s.id, data.card, currentScore()),
    })),
    ...data.card.customCards.map((c, i) => ({
      key: `custom-${i}`,
      label: c.label,
      make: () => customCard(c.url),
    })),
  ];
  const blobFor = (o: Option) => {
    const key = o.key.startsWith('custom') ? o.key : `${o.key}|${currentScore() ?? ''}`;
    if (!cache.has(key)) cache.set(key, o.make());
    return cache.get(key)!;
  };

  // One button per card, each with a small preview.
  for (const o of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'share-option';
    btn.dataset.key = o.key;
    btn.setAttribute('aria-pressed', String(o.key === selected));
    btn.innerHTML = '<div class="share-thumb"></div><span></span>';
    btn.querySelector('span')!.textContent = o.label;
    btn.addEventListener('click', () => {
      selected = o.key;
      for (const b of $$('.share-option', optionsEl)) b.setAttribute('aria-pressed', String(b.dataset.key === selected));
    });
    optionsEl.appendChild(btn);
  }

  const renderThumbs = async () => {
    for (const o of options) {
      const thumb = $(`.share-option[data-key="${o.key}"] .share-thumb`, optionsEl)!;
      try {
        const blob = await blobFor(o);
        const img = document.createElement('img');
        img.alt = '';
        img.src = URL.createObjectURL(blob);
        thumb.replaceChildren(img);
      } catch {
        thumb.textContent = '–';
      }
    }
  };

  const close = () => {
    dialog.hidden = true;
    document.documentElement.classList.remove('share-open');
    opener?.focus();
  };

  for (const btn of $$('[data-action="share-card"]')) {
    btn.addEventListener('click', () => {
      opener = btn;
      try { score = sessionStorage.getItem(`quiz:${data.card.slug}`); } catch { score = null; }
      scoreRow.hidden = !score;
      dialog.hidden = false;
      document.documentElement.classList.add('share-open');
      $<HTMLElement>('.share-option[aria-pressed="true"]', optionsEl)?.focus();
      renderThumbs();
    });
  }
  scoreBox.addEventListener('change', renderThumbs);
  $('[data-action="close-share"]', dialog)?.addEventListener('click', close);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const chosen = async () => {
    const o = options.find((x) => x.key === selected) ?? options[0];
    const blob = await blobFor(o);
    const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
    return { blob, name: `${data.card.slug}-${o.key}.${ext}` };
  };
  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    try { const { blob, name } = await chosen(); await share(blob, name, `${data.card.title} · ${data.card.artist}`); }
    finally { shareBtn.disabled = false; }
  });
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    try { const { blob, name } = await chosen(); download(blob, name); }
    finally { downloadBtn.disabled = false; }
  });
}

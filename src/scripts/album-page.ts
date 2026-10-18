import { controllable, player, type PlayerConfig, type Source } from './player';
import type { CardData, CardStyle } from './share-card';
import { createCardRow, quizScore, type ShareSetup } from './share-ui';
import { initWelcome } from './welcome';

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

  const setup: ShareSetup = { card: data.card, cardStyles: data.cardStyles, labels: shareLabels() };
  initShare(setup);
  initShareStrip(setup);
  initWelcome();
}

function shareLabels() {
  const d = $<HTMLElement>('[data-share-labels]')?.dataset;
  return { share: d?.share || 'Share', download: d?.download || 'Download' };
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
        // Lets the cards section below add the new score straight away.
        document.dispatchEvent(new CustomEvent('quiz:scored', { detail: `${score}/${questions.length}` }));
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

/* ---------- Share dialog: swipe through the cards, share or download any of them ---------- */
function initShare(setup: ShareSetup) {
  const dialog = $('[data-share-dialog]');
  const track = dialog && $('[data-share-options]', dialog);
  if (!dialog || !track) return;
  const scoreRow = $('[data-share-score]', dialog)!;
  const scoreBox = $<HTMLInputElement>('[data-share-include-score]', dialog)!;
  let score: string | null = null;
  let opener: HTMLElement | null = null;
  const row = createCardRow(setup, track, $('[data-share-dots]', dialog), () => (score && scoreBox.checked ? score : null));

  const close = () => {
    dialog.hidden = true;
    document.documentElement.classList.remove('share-open');
    opener?.focus();
  };

  for (const btn of $$('[data-action="share-card"]')) {
    btn.addEventListener('click', () => {
      opener = btn;
      score = quizScore(setup.card.slug);
      scoreRow.hidden = !score;
      dialog.hidden = false;
      document.documentElement.classList.add('share-open');
      track.scrollLeft = 0;
      $<HTMLElement>('.share-slide-actions .btn', track)?.focus();
      row.render();
    });
  }
  scoreBox.addEventListener('change', row.render);
  $('[data-action="close-share"]', dialog)?.addEventListener('click', close);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

/* ---------- "Take it with you": the same cards, always visible on the page ---------- */
function initShareStrip(setup: ShareSetup) {
  const root = $('[data-share-strip]');
  const track = root && $('[data-strip-track]', root);
  if (!root || !track) return;
  const scoreRow = $('[data-strip-score]', root)!;
  const scoreBox = $<HTMLInputElement>('[data-strip-include-score]', root)!;
  let score = quizScore(setup.card.slug);
  scoreRow.hidden = !score;
  const row = createCardRow(setup, track, $('[data-strip-dots]', root), () => (score && scoreBox.checked ? score : null));

  // Prev/next arrows for mouse users; phones simply swipe.
  const prev = $<HTMLButtonElement>('[data-strip="prev"]', root);
  const next = $<HTMLButtonElement>('[data-strip="next"]', root);
  prev?.addEventListener('click', () => row.go(-1));
  next?.addEventListener('click', () => row.go(1));
  const syncArrows = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max;
  };
  track.addEventListener('scroll', syncArrows, { passive: true });
  addEventListener('resize', syncArrows);
  syncArrows();

  // Draw the cards only when the section is about to come into view, so the page loads light.
  const lazy = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { lazy.disconnect(); row.render().then(syncArrows); }
  }, { rootMargin: '600px 0px' });
  lazy.observe(root);

  scoreBox.addEventListener('change', () => { if (row.drawn) row.render(); });
  document.addEventListener('quiz:scored', (e) => {
    score = (e as CustomEvent<string>).detail;
    scoreRow.hidden = false;
    scoreBox.checked = true;
    if (row.drawn) row.render();
  });
}

/* Welcome popup: shown once per visitor (per browser), on the home page only.
   The browser remembers the "version" it has seen. Change the version in
   Site settings › Welcome popup and everyone sees the new message once more. */

const KEY = 'aotw:welcome';

export function initWelcome() {
  const box = document.querySelector<HTMLElement>('[data-welcome]');
  if (!box) return;
  const version = box.dataset.version || '1';
  let seen: string | null;
  try { seen = localStorage.getItem(KEY); } catch { return; } // no storage: never nag on every visit
  if (seen === version) return;

  let opener: Element | null = null;
  const close = () => {
    if (box.hidden) return;
    box.hidden = true;
    document.documentElement.classList.remove('welcome-open');
    (opener as HTMLElement | null)?.focus?.();
  };
  const open = () => {
    // Never stack on top of the share window or listening mode.
    const busy = document.documentElement.classList.contains('share-open') || document.documentElement.classList.contains('listening-open');
    if (busy) { setTimeout(open, 4000); return; }
    try { localStorage.setItem(KEY, version); } catch { /* ignore */ }
    opener = document.activeElement;
    box.hidden = false;
    document.documentElement.classList.add('welcome-open');
    box.querySelector<HTMLElement>('[data-welcome-go]')?.focus();
  };

  for (const el of box.querySelectorAll('[data-welcome-close], [data-welcome-go]')) el.addEventListener('click', close);
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      // Keep keyboard focus inside the popup while it's open.
      const items = [...box.querySelectorAll<HTMLElement>('button, a[href]')];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // A short pause first, so the album gets a moment on screen before the popup.
  setTimeout(open, 1600);
}

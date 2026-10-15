import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/ui';

export type AlbumData = CollectionEntry<'albums'>['data'];
export type Album = AlbumData & {
  issue: number; // 1 for the first album ever published, 2 for the next, ...
  lang: Lang;
  translated: boolean; // false when an Italian page falls back to English content
};

// Albums dated in the future stay hidden until their publish date.
// Run `SHOW_SCHEDULED=true npm run dev` to preview them locally.
const showScheduled = import.meta.env.SHOW_SCHEDULED === 'true';

/** All published albums in the given language, oldest first. */
export async function getAlbums(lang: Lang): Promise<Album[]> {
  const entries = await getCollection('albums');
  const byLang = (l: string) =>
    new Map(entries.filter((e) => e.id.split('/')[0] === l).map((e) => [e.data.slug, e.data]));

  const english = byLang('en');
  const local = byLang(lang);
  const now = new Date();

  return [...english.values()]
    .filter((a) => showScheduled || a.publishDate <= now)
    .sort((a, b) => a.publishDate.getTime() - b.publishDate.getTime())
    .map((en, i) => {
      const own = local.get(en.slug);
      const data = own ?? en;
      // The publish date and accent colour always come from the English entry,
      // so the two languages can never drift apart.
      return { ...data, publishDate: en.publishDate, accent: en.accent || data.accent, issue: i + 1, lang, translated: Boolean(own) };
    });
}

export async function getCurrentAndArchive(lang: Lang) {
  const albums = await getAlbums(lang);
  const current = albums.at(-1);
  const archive = albums.slice(0, -1).reverse(); // newest first
  return { current, archive, all: albums };
}

/** Join a path onto the site's base path (needed on GitHub Pages project sites). */
export function url(path = ''): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clean = path.replace(/^\//, '');
  return `${base}/${clean}`;
}

export const homeUrl = (lang: Lang) => url(lang === 'en' ? '' : 'it/');
export const albumUrl = (lang: Lang, slug: string) => url(`${lang === 'en' ? '' : 'it/'}albums/${slug}/`);
export const shopUrl = (lang: Lang, slug: string) => url(`${lang === 'en' ? '' : 'it/'}shop/${slug}/`);

/** Dark or light text, whichever reads better on the accent colour. */
export function inkOn(hex: string): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return '#0E1116';
  const [r, g, b] = m.slice(1).map((c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.18 ? '#0E1116' : '#FFFFFF';
}

export function formatWeek(date: Date, lang: Lang): string {
  const end = new Date(date.getTime() + 6 * 864e5);
  const fmt = new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' });
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Rome' }).format(end);
  return `${fmt.format(date)} – ${fmt.format(end)} ${year}`;
}

/** "9:22" -> 562 seconds. Returns null when empty or unreadable. */
export function toSeconds(time: string): number | null {
  if (!time) return null;
  const parts = time.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((total, p) => total * 60 + p, 0);
}

/** Apple Music share link -> embeddable player URL. Empty string when it isn't an Apple Music link. */
export function appleEmbedUrl(input: string): string {
  try {
    const u = new URL(input.trim());
    if (!/(^|\.)music\.apple\.com$/.test(u.hostname)) return '';
    u.hostname = 'embed.music.apple.com';
    return u.toString();
  } catch {
    return '';
  }
}

/** Amazon Music embed code or embed link -> player URL. Empty string when it isn't an Amazon Music embed. */
export function amazonEmbedUrl(input: string): string {
  const raw = input.trim();
  const src = raw.startsWith('<') ? raw.match(/src=["']([^"']+)["']/)?.[1] ?? '' : raw;
  try {
    const u = new URL(src.replace(/&amp;/g, '&'));
    if (!/^music\.amazon\./.test(u.hostname) || !u.pathname.includes('/embed/')) return '';
    return u.toString();
  } catch {
    return '';
  }
}

export function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

export function sidesOf(album: AlbumData): string[] {
  return [...new Set(album.tracks.map((t) => t.side || 'A'))];
}

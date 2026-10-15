// One controller for every listening service.
// YouTube and Spotify offer a JavaScript API, so the page can start, pause and follow them
// (and the vinyl spins in sync). Apple Music and Amazon Music only offer a plain embedded
// player: the page loads it, and the visitor uses its own controls.
// Nothing loads from either service until the visitor clicks Play or "Load player",
// so no third-party cookies are set before they choose to listen.
//
// Other parts of the page listen for two events on `player.events`:
//   'state' -> detail: { playing: boolean }
//   'track' -> detail: { index: number }   (when the provider can tell us)

export type Source = 'youtube' | 'spotify' | 'apple' | 'amazon';

/** Services the page can control directly. */
export const controllable = (s: Source) => s === 'youtube' || s === 'spotify';

export interface PlayerConfig {
  youtubePlaylistId?: string;
  youtubeVideoId?: string;
  spotifyAlbumId?: string;
  appleEmbedUrl?: string;
  amazonEmbedUrl?: string;
  trackStarts: (number | null)[]; // seconds, only used with a single full-album YouTube video
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    onSpotifyIframeApiReady?: (api: any) => void;
  }
}

const events = new EventTarget();
let config: PlayerConfig = { trackStarts: [] };
let source: Source = 'youtube';
let playing = false;
let trackIndex = 0;
let yt: any = null;
let sp: any = null;
let ytPoll: number | undefined;
const loading: Partial<Record<Source, Promise<void>>> = {};

function emit(type: 'state' | 'track', detail: object) {
  events.dispatchEvent(new CustomEvent(type, { detail }));
}

function setPlaying(value: boolean) {
  if (playing === value) return;
  playing = value;
  document.documentElement.classList.toggle('is-playing', value);
  emit('state', { playing });
}

function setTrack(index: number) {
  if (index < 0 || index === trackIndex) return;
  trackIndex = index;
  emit('track', { index });
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

function slot(which: Source) {
  return document.querySelector<HTMLElement>(`[data-slot="${which}"]`);
}

/* ---------- YouTube ---------- */

function youtubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    loadScript('https://www.youtube.com/iframe_api');
  });
}

function trackFromTime(seconds: number) {
  let index = 0;
  config.trackStarts.forEach((start, i) => {
    if (start !== null && seconds >= start) index = i;
  });
  return index;
}

async function loadYouTube(autoplay: boolean) {
  const el = slot('youtube');
  if (!el) return;
  const YT = await youtubeApi();
  el.innerHTML = '<div id="yt-player"></div>';
  const usePlaylist = Boolean(config.youtubePlaylistId);

  await new Promise<void>((resolve) => {
    yt = new YT.Player('yt-player', {
      host: 'https://www.youtube-nocookie.com',
      width: '100%',
      height: '100%',
      videoId: usePlaylist ? undefined : config.youtubeVideoId,
      playerVars: usePlaylist
        ? { listType: 'playlist', list: config.youtubePlaylistId, playsinline: 1, rel: 0 }
        : { playsinline: 1, rel: 0 },
      events: {
        onReady: () => {
          el.classList.add('is-loaded');
          if (autoplay) yt.playVideo();
          resolve();
        },
        onStateChange: (e: { data: number }) => {
          if (e.data === YT.PlayerState.PLAYING) {
            setPlaying(true);
            if (usePlaylist) setTrack(yt.getPlaylistIndex());
            else startPolling();
          } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
            setPlaying(false);
            stopPolling();
          }
        },
      },
    });
  });
}

function startPolling() {
  stopPolling();
  if (!config.trackStarts.some((s) => s !== null)) return;
  ytPoll = window.setInterval(() => setTrack(trackFromTime(yt.getCurrentTime())), 1000);
}
function stopPolling() {
  if (ytPoll) window.clearInterval(ytPoll);
}

/* ---------- Spotify ---------- */

let spotifyApiPromise: Promise<any> | null = null;
function spotifyApi(): Promise<any> {
  spotifyApiPromise ??= new Promise((resolve) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api);
    loadScript('https://open.spotify.com/embed/iframe-api/v1');
  });
  return spotifyApiPromise;
}

async function loadSpotify(autoplay: boolean) {
  const el = slot('spotify');
  if (!el) return;
  const api = await spotifyApi();
  el.innerHTML = '<div id="sp-player"></div>';
  await new Promise<void>((resolve) => {
    api.createController(
      document.getElementById('sp-player'),
      { uri: `spotify:album:${config.spotifyAlbumId}`, width: '100%', height: '152' },
      (controller: any) => {
        sp = controller;
        controller.addListener('ready', () => {
          el.classList.add('is-loaded');
          if (autoplay) controller.play();
          resolve();
        });
        controller.addListener('playback_update', (e: { data: { isPaused: boolean } }) => setPlaying(!e.data.isPaused));
      },
    );
  });
}

/* ---------- Apple Music / Amazon Music (plain embeds) ---------- */

const embedsLoaded = new Set<Source>();

function loadEmbed(which: 'apple' | 'amazon') {
  const el = slot(which);
  const src = which === 'apple' ? config.appleEmbedUrl : config.amazonEmbedUrl;
  if (!el || !src) return Promise.resolve();
  const frame = document.createElement('iframe');
  frame.src = src;
  frame.title = which === 'apple' ? 'Apple Music' : 'Amazon Music';
  frame.allow = 'autoplay *; encrypted-media *; clipboard-write';
  if (which === 'apple') {
    frame.setAttribute('sandbox', 'allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation');
  }
  el.replaceChildren(frame);
  el.classList.add('is-loaded');
  embedsLoaded.add(which);
  return Promise.resolve();
}
/* ---------- Public API ---------- */

function isLoaded(which: Source) {
  if (which === 'youtube') return Boolean(yt);
  if (which === 'spotify') return Boolean(sp);
  return embedsLoaded.has(which);
}

function load(which: Source, autoplay: boolean) {
  loading[which] ??=
    which === 'youtube' ? loadYouTube(autoplay) : which === 'spotify' ? loadSpotify(autoplay) : loadEmbed(which);
  return loading[which];
}

export const player = {
  events,
  get playing() { return playing; },
  get source() { return source; },
  get track() { return trackIndex; },

  init(cfg: PlayerConfig, initial: Source) {
    config = cfg;
    source = initial;
  },

  load(which: Source = source) {
    return load(which, false);
  },

  toggle() {
    if (!isLoaded(source)) return load(source, true);
    if (!controllable(source)) return;
    if (source === 'youtube') (playing ? yt.pauseVideo() : yt.playVideo());
    else sp.togglePlay();
  },

  pause() {
    if (source === 'youtube' && yt) yt.pauseVideo();
    if (source === 'spotify' && sp) sp.pause();
  },

  setSource(which: Source) {
    if (which === source) return;
    this.pause();
    setPlaying(false);
    source = which;
  },

  /** Jump to a track. Returns false when the provider can't do it (the page then just shows the note). */
  playTrack(index: number): boolean {
    if (source === 'youtube' && yt) {
      if (config.youtubePlaylistId) {
        yt.playVideoAt(index);
        return true;
      }
      const start = config.trackStarts[index];
      if (start !== null && start !== undefined) {
        yt.seekTo(start, true);
        yt.playVideo();
        setTrack(index);
        return true;
      }
    }
    setTrack(index);
    return false;
  },

  next(total: number) {
    if (source === 'youtube' && yt && config.youtubePlaylistId) return yt.nextVideo();
    this.playTrack((trackIndex + 1) % total);
  },

  prev(total: number) {
    if (source === 'youtube' && yt && config.youtubePlaylistId) return yt.previousVideo();
    this.playTrack((trackIndex - 1 + total) % total);
  },
};

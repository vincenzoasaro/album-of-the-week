import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The CMS can leave text fields empty or omit lists entirely,
// so everything except the essentials is optional with safe defaults.
const text = z.string().optional().default('');
const list = <T extends z.ZodType>(item: T) => z.array(item).optional().default([]);

const albums = defineCollection({
  // One JSON file per album per language: src/content/albums/en/kind-of-blue.json
  // The id keeps the language folder ("en/kind-of-blue") so the two versions don't collide.
  loader: glob({ pattern: '**/*.json', base: './src/content/albums', generateId: ({ entry }) => entry.replace(/\.json$/, '') }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    artist: z.string(),
    year: z.coerce.number(),
    label: text,
    genre: text,
    length: text,
    publishDate: z.coerce.date(),
    accent: z.string().optional().default('#7FB2E5'),
    tagline: text,
    cover: text,
    introAudio: text,
    introLength: text,

    spotifyAlbumId: text,
    youtubePlaylistId: text,
    youtubeVideoId: text,
    // Paste the album's share link from Apple Music (music.apple.com/...).
    appleMusicUrl: text,
    // Paste the embed code (or its link) from Amazon Music's Share > Embed option.
    amazonMusicEmbed: text,

    sessionsHeadline: text,
    sessionsText: text,
    sessions: list(z.object({ date: z.string(), label: text, tracks: text })),

    lineupHeadline: text,
    musicians: list(z.object({ name: z.string(), instrument: text, plays: text })),

    tracks: list(
      z.object({
        side: z.string().optional().default('A'),
        title: z.string(),
        time: text,
        recorded: text,
        note: text,
        instrumental: z.boolean().optional().default(false),
        lyricsUrl: text,
        // Only for a single full-album YouTube video: where this track starts (e.g. "9:22").
        ytStart: text,
      }),
    ),

    worldHeadline: text,
    world: list(z.object({ when: z.string(), what: z.string() })),
    alsoThisYear: list(z.object({ title: z.string(), artist: text })),

    release: list(z.object({ label: z.string(), value: z.string() })),
    trivia: list(z.string()),

    quiz: list(
      z.object({
        question: z.string(),
        options: list(z.string()),
        // 1 = first option. Editors count from one, not zero.
        answer: z.coerce.number(),
        explanation: text,
      }),
    ),

    // Share cards: a line for the "liner notes" card, and ready-made card images.
    cardQuote: text,
    shareCards: list(z.object({ label: z.string(), image: z.string() })),

    shopIntro: text,
    shop: list(
      z.object({
        title: z.string(),
        subtitle: text,
        items: list(
          z.object({
            kind: text,
            name: z.string(),
            note: text,
            price: text,
            retailer: text,
            url: text,
            image: text,
            affiliate: z.boolean().optional().default(true),
          }),
        ),
      }),
    ),
  }),
});

// Fixed pages such as the privacy policy: one Markdown file per language.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z.object({ title: z.string(), updated: z.coerce.date().optional() }),
});

export const collections = { albums, pages };

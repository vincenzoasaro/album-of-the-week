# Album of the week

A weekly, bilingual (English / Italian) album site built with Astro, edited through
Sveltia CMS and published for free on GitHub Pages.

## Run it on your computer

You need Node.js 22 or newer.

```bash
npm install
npm run dev          # opens the site at http://localhost:4321
npm run build        # builds the final site into dist/
npm run check        # checks the code for errors
```

To preview albums scheduled for the future: `SHOW_SCHEDULED=true npm run dev`

## Where things live

| What | Where |
| --- | --- |
| Album content (one file per language) | `src/content/albums/en/` and `src/content/albums/it/` |
| Site name, newsletter, contact | `src/data/site.json` |
| Interface text in both languages | `src/i18n/ui.ts` |
| Page sections | `src/components/` |
| Colours, fonts, layout | `src/styles/global.css` |
| Player (YouTube + Spotify) | `src/scripts/player.ts` |
| Scroll animations | `src/scripts/reveal.ts` |
| CMS forms | `public/admin/config.yml` |
| Automatic publishing | `.github/workflows/deploy.yml` |

## Put it online (one time)

1. Create a new repository on GitHub and push this folder to the `main` branch.
2. In the repository: **Settings › Pages › Source: GitHub Actions**.
3. The workflow builds and publishes the site. The address appears in **Actions** and in **Settings › Pages**.
4. Optional: add your own domain in **Settings › Pages › Custom domain**.

## Set up the editor (one time)

1. In `public/admin/config.yml`, replace `YOUR-GITHUB-USERNAME/YOUR-REPO` with your repository and push.
2. On GitHub, create a fine-grained personal access token limited to this repository,
   with **Contents: Read and write** permission.
3. Open `/admin/` on your site and choose to sign in with an access token.

Every save in the editor is a commit to `main`, and the site rebuilds in about a minute.

## How scheduling works

Each album has a **publish date**. Albums dated in the future are not built at all.
The workflow rebuilds the site every night just after midnight Italian time, so the
newest album whose date has arrived becomes the album of the week, with its own
accent colour, and the previous one moves to the archive.

Note: GitHub pauses scheduled workflows in repositories with no activity for 60 days.
Publishing weekly keeps it active.

## Adding an album

In the editor: **Albums › New album**. Fill in the English version, then switch to
Italian and translate the text fields; dates, IDs and colours are copied automatically.

- **Spotify album ID**: the part after `/album/` in the album's Spotify link.
- **YouTube**: a playlist ID is best (the part after `list=`), because the site can then
  follow and jump between tracks. With a single full-album video, add each track's start time.
- **Apple Music**: in Apple Music, use Share › Copy Link and paste the link.
- **Amazon Music**: on the Amazon Music website, use Share › Embed and paste the code.
- Leave a service empty when the album isn't on it: the site simply won't show it.
  YouTube and Spotify can be controlled by the page (the record spins in time with the music);
  Apple Music and Amazon Music use their own play buttons inside the player.
- **Lyrics**: link to a licensed lyrics page per track; the site doesn't host lyrics.

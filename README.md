# $GANG — Grind And Never Give-up

The official site for **$GANG** on Solana: a GTA-inspired landing page with a
live Three.js city rendered behind the UI, plus mission / leaderboard / buy
panels.

The page is a **cinematic landing site**, not a playable game — the camera
orbits the city automatically and the remaining HUD pieces (wanted stars,
radar) are decorative styling only. There is no player, no collision, and no
interaction system.

## Getting Started

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

```bash
npm run build      # production build -> dist/
npm run preview    # serve the production build
```

## Configuration

Copy `.env.example` to `.env` and fill in what's live. Every value is optional:
the contract address falls back to `TBA`, and any link left blank renders as a
greyed-out "Coming soon" instead of a dead link.

| Variable | Used for |
| --- | --- |
| `VITE_TOKEN_CONTRACT_ADDRESS` | CA shown on the start screen, HUD, and BUY panel |
| `VITE_DEXSCREENER_URL` | Dexscreener links |
| `VITE_BUY_URL` | Buy button (Raydium / Jupiter / pump.fun) |

On Vercel, set these under **Project → Settings → Environment Variables**, then
redeploy. Vite inlines `VITE_*` values at build time, so a rebuild is required
for changes to take effect.

## Project Structure

```
index.html          Markup: nav, intro overlay, start screen, HUD, panels
src/main.js         Entry point — renderer, camera orbit, panel + link wiring
src/city.js         Procedural city geometry and traffic
src/assetLoader.js  Texture loading and shared materials
src/textures.js     Procedural canvas textures
src/lighting.js     Sun, ambient, hemisphere lighting and skybox
src/postprocessing.js  Color grading, film grain, vignette
src/minimap.js      Decorative radar
src/audio.js        Ambient loop and radio toggle
src/styles.css      All UI styling, including responsive breakpoints
public/             Static assets served at the site root
```

## Tech Stack

- **Three.js** — 3D rendering
- **Vite** — build tool and dev server
- Vanilla JS + CSS, no framework

## Notes

- The intro video (`public/gang-promo.mp4`) is encoded for web delivery
  (H.264, CRF 23, `+faststart`). Re-encode rather than dropping in a raw
  export — the original was 71 MB.
- The radio track in `public/` is a copyrighted Rockstar recording. Replace it
  with licensed or original audio before any commercial use.

## License

Assets belong to their respective owners.

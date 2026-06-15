# DiffusionPack — RAL 2026 Project Page

Academic project page for **DiffusionPack: Bin Packing with Custom Human Preferences**, submitted to the 10th Conference on Robot Learning (RAL 2026).

## Structure

```
diffusionpack-site/
├── docs/
│   ├── index.html              # Main website (self-contained, no build step)
│   └── demo_trajectories.json  # Pre-computed denoising trajectories (you generate this)
├── scripts/
│   └── capture_trajectories.py # Script to generate demo_trajectories.json
├── .github/
│   └── workflows/
│       └── deploy.yml          # Auto-deploy to GitHub Pages on push
├── _config.yml                 # GitHub Pages config
└── README.md
```

## Quick Start

### 1. Deploy the site (no trajectories yet)

```bash
# Push to GitHub, enable Pages from /docs folder in repo Settings → Pages
git add .
git commit -m "Initial project page"
git push
```

The site works immediately with a placeholder in the demo section until you add `demo_trajectories.json`.

### 2. Generate real denoising trajectories

Run from your **DiffusionPack repo root** (with conda env activated):

```bash
# Fast run — good for testing (64 candidates, 30 keyframes)
python scripts/capture_trajectories.py \
    --out docs/demo_trajectories.json \
    --sample_size 64 \
    --steps 30 \
    --device cuda

# Full quality — as in the paper (512 candidates, 40 keyframes)
python scripts/capture_trajectories.py \
    --out docs/demo_trajectories.json \
    --sample_size 512 \
    --steps 40 \
    --device cuda
```

Checkpoint paths are pre-configured (from the Diff-BPP repo root):
- `ckpt/16_final/16_final.pth`
- `ckpt/32_final/32_final.pth`

### 3. Embed trajectories into the site

The site expects `demo_trajectories.json` to be embedded in `docs/index.html` as the `TRAJ_DATA` constant. Re-run the embed step:

```bash
python scripts/embed_trajectories.py
```

Or manually replace the `const TRAJ_DATA = {...};` block in `docs/index.html` with the contents of your new JSON file.

### 4. Push updated site

```bash
git add docs/
git commit -m "Update demo trajectories"
git push
```

## View the Site Locally

This is a plain static site (HTML/CSS/JS in `docs/` — no Jekyll or npm build step), so to preview changes before pushing, serve the `docs/` folder with a local web server:

```bash
cd docs
python3 -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

Workflow:
1. Edit files in `docs/` (`index.html`, `style.css`, `app.js`)
2. **Refresh the browser** to see changes — hard-refresh (`Ctrl+Shift+R`) to bypass the cache for CSS/JS
3. When happy, commit & push

> **Why a server instead of opening `index.html` directly?** `app.js` uses `fetch()` to load `demo_trajectories.json`, which browsers block over `file://`. A local server avoids that. Stop the server with `Ctrl+C`.

## GitHub Pages Setup

1. Go to your repo **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` (or `master`), folder: `/docs`
4. Save — your site will be at `https://<username>.github.io/<repo-name>/`

## Customising the Site

All content is in `docs/index.html` — no build system, no dependencies to install.

| What to change | Where |
|---|---|
| Author names & affiliations | Search `Anonymous Author` in `index.html` |
| Paper / arXiv / GitHub links | Search `href="#"` — replace with real URLs |
| Robot video | Search `robot-video-placeholder` — replace with `<video>` or `<iframe>` |
| BibTeX entry | Search `bibtex-text` |
| Colour scheme | CSS variables at the top: `--accent`, `--ink`, `--paper`, etc. |

## Dependencies

The website loads two libraries from CDN (no install needed):
- [Three.js r128](https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js) — 3D rendering
- [Chart.js 4.4.1](https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js) — result charts
- [Google Fonts](https://fonts.googleapis.com) — Source Serif 4, Inter, JetBrains Mono

The site works offline except for fonts (system fallbacks apply).

## capture_trajectories.py — Full Options

```
usage: capture_trajectories.py [-h]
    [--ckpt16 CKPT16] [--ckpt32 CKPT32]
    [--ckptdir16 CKPTDIR16] [--ckptdir32 CKPTDIR32]
    [--out OUT]
    [--steps STEPS]
    [--sample_size SAMPLE_SIZE]
    [--device DEVICE]
    [--scenarios [SCENARIOS ...]]
    [--projection {EMS,EP,CP,None}]
    [--sampling_steps SAMPLING_STEPS]

Options:
  --steps           Number of keyframes to record across 250 sampling steps (default: 30)
  --sample_size     Candidate batch size — higher = better quality, slower (default: 64)
  --device          cuda or cpu (default: cuda if available)
  --scenarios       Run only specific scenario IDs:
                      csd16_seed42  csd16_seed7
                      csd32_seed42  csd32_seed13
                      rsd16_seed42  rsd32_seed42
  --projection      Keypoint strategy: EMS (best), EP, CP, None (default: EMS)
  --sampling_steps  DDPM inference steps (default: 250)
```

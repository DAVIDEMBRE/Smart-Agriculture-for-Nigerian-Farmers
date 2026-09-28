# Setup, running and deployment

Smart Farming for Rural Nigeria — a Next.js application that serves two trained
models (crop recommendation and irrigation decision) with no Python at runtime.

---

## Do I need Docker?

**No.** Nothing in this project needs it.

- The app is a standard Next.js project. Vercel builds and runs it natively.
- The models are served from compact JSON files read by TypeScript. There is no
  Python service, no model server, no database.
- Python is needed **only offline**, and only if you re-export models after a new
  Colab training run. Even then `uv` handles it without Docker or a virtualenv.

Adding Docker would give you a second thing to maintain and buy nothing.

---

## 1. Prerequisites

### Node.js 24

The only hard requirement.

**macOS**

```bash
brew install node@24
```

**Windows (PowerShell)**

```powershell
winget install OpenJS.NodeJS.LTS
```

**Linux (Debian/Ubuntu)**

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Or download the installer from [nodejs.org](https://nodejs.org). Verify:

```bash
node --version    # v24.x
```

### pnpm (recommended)

The repo pins `pnpm@11.19.0` in `package.json`, and Corepack reads that pin:

```bash
corepack enable
```

Open a **new terminal** afterwards so `PATH` refreshes.

> If `corepack enable` fails with a permissions error, that is fine — **every
> `pnpm` command below also works as `npm run`**, because npm puts
> `node_modules/.bin` on `PATH`. Use `npx --yes pnpm@11.19.0 install` for the
> install step.

### Git

```bash
brew install git                 # macOS
winget install Git.Git           # Windows
sudo apt-get install -y git      # Linux
```

On Windows, when the installer asks about line endings choose
**"Checkout as-is, commit as-is"** to avoid CRLF noise in diffs.

---

## 2. Get the code and install

```bash
git clone https://github.com/Victorasuquo/Smart-farming-for-rural-Nigeria.git
cd Smart-farming-for-rural-Nigeria
pnpm install
```

First install takes a couple of minutes.

**Windows long-path errors during install?** Run once as Administrator:

```powershell
git config --system core.longpaths true
```

---

## 3. Environment variables

Create two files in the project root.

### `.env.example` — committed, a template with no secrets

```bash
# Rotate the key exposed in the source notebook before setting this value.
OPENWEATHER_API_KEY=

# Optional. When set, the same-origin prediction routes forward to FastAPI.
FASTAPI_BASE_URL=
```

### `.env.local` — your real values, **never committed**

```bash
OPENWEATHER_API_KEY=your_rotated_key_here
```

`.gitignore` already excludes `.env.local`. Verify with:

```bash
git check-ignore -v .env.local     # should print the matching rule
```

**Notes**

- Get a free key at [openweathermap.org/api](https://openweathermap.org/api).
  A new key can take up to two hours to activate.
- **Do not reuse the key that was in the notebook.** It was in a plaintext file
  and must be treated as compromised.
- Without a key the site still runs fully — only the weather card shows its
  "unavailable" state. Predictions do not depend on it.
- Leave `FASTAPI_BASE_URL` empty. It is a hook for an optional Python service
  that this project does not include or need.

---

## 4. Run it

```bash
pnpm dev
```

Open **http://localhost:3000**

| Route | What it does |
|---|---|
| `/` | Landing page, live Uyo weather |
| `/predict` | Crop recommendation (CatBoost, 22 crops) + watering guidance |
| `/irrigate` | Irrigation decision (XGBoost, 5 crops) |
| `/research` | Methods, leaderboard, figures, live model status |

Use the header toggles to switch language (English / Nigerian Pidgin) and theme.

### Sample values to test with

**`/predict`** — each of these is a real row from the training data:

| Expect | N | P | K | Temp | Humidity | pH | Rainfall |
|---|---|---|---|---|---|---|---|
| rice | 64 | 45 | 43 | 25.6 | 83.5 | 5.53 | 209.9 |
| maize | 74 | 55 | 19 | 18.1 | 62.9 | 6.29 | 84.2 |
| banana | 107 | 72 | 45 | 28.1 | 81.5 | 5.79 | 91.4 |
| mothbeans | 14 | 55 | 15 | 27.3 | 55.3 | 8.05 | 73.4 |

**`/irrigate`** — Wheat / Black Soil:

| Expect | Stage | Moisture | Temp | Humidity |
|---|---|---|---|---|
| Irrigate now | Germination | 1 | 25 | 80 |
| Do not irrigate | Maturation | 81 | 45 | 20 |

### Other commands

```bash
pnpm build             # production build
pnpm start             # serve the production build
pnpm lint              # eslint
pnpm typecheck         # tsc --noEmit
pnpm test              # 167 unit tests (~1 second)
pnpm verify:manifest   # model manifests + SHA-256 checksums
```

### End-to-end tests (optional)

```bash
pnpm exec playwright install chromium    # once, ~95 MB
pnpm exec playwright test --project=desktop --project=mobile
```

Playwright builds and starts its own production server on port 3000. If
`pnpm dev` is already running there it reuses it, and the dev server's origin
check makes browser-issued POSTs fail. Either stop `pnpm dev`, or run the suite
on its own port:

```bash
PLAYWRIGHT_PORT=3210 pnpm exec playwright test --project=desktop --project=mobile
```

The `visual` project is macOS-only (baselines are platform-suffixed). Skip it on
Windows and Linux, or regenerate baselines there with `pnpm test:e2e:update`.

---

## 5. Python — only for re-exporting models

**Skip this section entirely unless you have retrained in Colab.** The models
already in `artifacts/` are ready to serve.

Install [uv](https://docs.astral.sh/uv/), which manages its own Python and
packages — no `venv`, no `pip install`, nothing added to your system Python:

```bash
brew install uv                       # macOS
winget install astral-sh.uv           # Windows
curl -LsSf https://astral.sh/uv/install.sh | sh   # Linux
```

After a Colab run, unzip `smart_farming_web_export.zip` and install it:

```bash
uv run --python 3.12 --with-requirements mlops/requirements.txt \
    python mlops/install_export.py <unzipped>/web_export

pnpm verify:manifest
pnpm test
```

> **Use `install_export.py`, never re-export from the `.joblib`.** Unpickling an
> XGBoost model under a different library version than pickled it can silently
> produce a different predictor. See `mlops/README.md`.

<details>
<summary>If you prefer a classic virtualenv instead of uv</summary>

```bash
python3.12 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r mlops/requirements.txt
python mlops/install_export.py <unzipped>/web_export
```

`.venv/` is gitignored. `uv` is still recommended: it pins the Python version
too, which matters because the artefacts were built against specific versions.

</details>

---

## 6. Push to GitHub

### Before the first push — security checklist

1. **Rotate the OpenWeather key** if you have not already.

2. **Remove the notebook that contains the old key in plaintext:**

   ```bash
   git rm --cached "Smart_farming_for_rural_Nigeria_ALL17 (6).ipynb" 2>/dev/null
   rm "Smart_farming_for_rural_Nigeria_ALL17 (6).ipynb"
   ```

   The clean notebook is `Notebooks/Smart_farming_for_rural_Nigeria_ALL17 (7).ipynb`,
   which reads the key from the environment. Keep that one.

3. **Confirm no secret is staged:**

   ```bash
   git add -A
   git diff --cached --name-only | grep -i "env\|\.ipynb" || echo "clean"
   git diff --cached -S"$(grep OPENWEATHER_API_KEY .env.local | cut -d= -f2)" --name-only
   ```

   The last command must print nothing. If it prints a filename, that file
   contains your key — remove it before continuing.

### Push

```bash
git add -A
git commit -m "Serve CatBoost crop recommender and XGBoost irrigation model"
git push -u origin main
```

**What gets committed:** roughly 28 MB of model artefacts (`artifacts/*.json`,
`crop-catboost.cbm`) and 22 MB of visual-test baselines. Both are well within
GitHub's 100 MB per-file limit. The 233 MB Colab bundle is gitignored.

---

## 7. Deploy to Vercel

Free (Hobby) tier is sufficient. Hobby is for non-commercial use; an academic
research project qualifies.

### Steps

1. Sign in at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project**, then import the repository.
3. Vercel auto-detects Next.js. **Do not change** framework, build command,
   output directory or install command.
4. Expand **Environment Variables** and add:

   | Name | Value | Environments |
   |---|---|---|
   | `OPENWEATHER_API_KEY` | your rotated key | Production, Preview, Development |

   Leave `FASTAPI_BASE_URL` unset.
5. **Deploy.** First build takes two to four minutes.

### Verify the deployment

Replace `<your-app>` with your Vercel URL:

```bash
curl https://<your-app>.vercel.app/api/v1/readiness
```

Expected — both models serving natively:

```json
{
  "status": "ready",
  "production_model_connected": true,
  "serving": {
    "crop_recommendation": "native",
    "irrigation_decision": "native"
  },
  "release_gate": null
}
```

If `crop_recommendation` says `"fixture"`, the model artefacts did not reach the
deployed function — check that `artifacts/*.model.json` were committed.

Then in a browser: run a prediction on `/predict`, an irrigation check on
`/irrigate`, and confirm `/research` shows **two** "Production model" cards.

### After deploying

- Every push to `main` redeploys automatically. Pull requests get preview URLs.
- Changing an environment variable requires a **redeploy** to take effect.
- Add a custom domain under **Settings → Domains** if you have one.

### Limits worth knowing

| | Hobby tier | This app |
|---|---|---|
| Bandwidth | 100 GB/month | Images dominate; fine for a research site |
| Function execution | 100 GB-hours/month | Predictions are sub-millisecond |
| Function bundle | 250 MB | ~16 MB including both models |
| Cold start | — | 1–2 s while the 15 MB model parses, then cached |

---

## Troubleshooting

**`pnpm: command not found`** — use `npm run <script>` instead, or run
`corepack enable` and open a new terminal.

**`Error: Cannot find module` after pulling changes** — run `pnpm install`;
dependencies changed.

**Port 3000 already in use** — `pnpm dev --port 3001`, or find and stop the
existing process: `lsof -ti:3000 | xargs kill` (macOS/Linux).

**Weather card shows "unavailable"** — `OPENWEATHER_API_KEY` is missing,
mistyped, or newly issued and not yet active (can take two hours). Predictions
are unaffected.

**Several E2E tests fail with 403 or "element not found"** — the dev server is
occupying port 3000 and Playwright reused it. Stop `pnpm dev`, or re-run with
`PLAYWRIGHT_PORT=3210`.

**Visual tests fail on Windows or Linux** — expected. Baselines were recorded on
macOS and are platform-suffixed. Run only `--project=desktop --project=mobile`.

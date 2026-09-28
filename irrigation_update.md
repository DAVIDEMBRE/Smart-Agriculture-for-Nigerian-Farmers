# Serve the real models: crop recommendation, irrigation decision, watering guidance

## Context

Every prediction the site makes today comes from `lib/fixture-predictor.ts`, a hard-coded centroid lookup. The real artefacts have now arrived in `artifacts/smart_farming_bundle/` (the complete Colab `/content/models/` directory, 233 MB): `classical_catboost.joblib` (the 99.77% model), `scaler.joblib`, `label_encoder.joblib`, plus all 17 other crop models and `all_17_models_comparison.csv`. **The irrigation model is not in the bundle** and must be retrained.

Decisions already made with the user:

- **Serving:** port inference to TypeScript inside the existing Next.js API routes. One Vercel deploy, free tier, no Python at runtime, no separate server. `FASTAPI_BASE_URL` stays as an optional upstream.
- **Artefacts:** commit the compact JSON models plus the native `.cbm`; the 233 MB bundle folder is never committed.
- **Irrigation labels:** match the thesis exactly. Binary; the 1,122 `result = 2` rows map to 0 ("do not irrigate") as the notebook did. The model card discloses this. Thesis §4.1.12 states the model "outputs either 0 (do not irrigate) or 1 (irrigate now)" and never mentions label 2.
- **Watering guidance:** the audio request (how often, morning/night, after rain) cannot come from any model trained on this data. It becomes a **standalone, rule-based guidance module** with a researched knowledge base for every crop, written by me from web research with sources, clearly labelled as agronomic guidance and not a model prediction. The user is supplying no content.
- **Figures:** any figure the retrain script writes gets a descriptive filename and an unnumbered caption. Never "Figure 1/2/3".

Two facts that shape the design and must be stated honestly on the site:

1. **The five irrigation crops (Carrot, Chilli, Potato, Tomato, Wheat) do not overlap the 22 recommendation crops.** "Recommend, then ask the model when to irrigate" cannot chain. The irrigation classifier is a separate tool; the guidance module is what connects a recommended crop to watering advice.
2. **The bundle's `all_17_models_comparison.csv` differs slightly from the notebook output I transcribed into `lib/research-data.ts`** (XGBoost default 0.993182 vs 0.9909; Attention MLP 0.620455 vs 0.6182; training times). The CSV is the run tied to the served artefacts, so it becomes the canonical source.

---

## Part A — Crop recommender: CatBoost in TypeScript

### A1. Export script (Python, run once, committed)
**New:** `mlops/export_crop_model.py`, `mlops/requirements.txt` (`catboost==1.2.10`, `scikit-learn==1.6.1` — the version that pickled the scaler, `numpy<2.3`, `pandas`, `joblib`, `xgboost`).
Run with `uv run --python 3.12 --with-requirements mlops/requirements.txt mlops/export_crop_model.py`.

- Load the three joblibs from `artifacts/smart_farming_bundle/saved_models/`.
- Re-derive the notebook split (`test_size=0.20, stratify=y, random_state=42`) and confirm held-out accuracy = 0.997727. Abort if it does not match — that would mean the artefact is not the thesis model.
- Write:
  - `artifacts/crop-catboost.cbm` — `model.save_model(format="cbm")`.
  - `artifacts/crop-catboost.model.json` — compact applier format (not raw CatBoost JSON): `{ schema_version, feature_order, scaler: {mean[], scale[]}, classes[], trees: [{ splits: [[featureIdx, border]…], leaves: base64 Float32 }], scale, bias[] }`. Built from `model.save_model(format="json")` `oblivious_trees` + `scale_and_bias`.
  - `artifacts/crop-golden.json` — all 2,200 rows: raw inputs, class probabilities, predicted label. The correctness oracle.
- Fill `artifacts/production-manifest.json`: version, `trained_at` (from the bundle file dates, noted as "exported from Colab run"), git revision, SHA-256 of both artefacts, metrics from the CSV, `dataset_versions.crop_recommendation = "sha256:<csv hash>"`, `status: "production"`, `release_gate: null`.

### A2. Applier
**New:** `lib/catboost-applier.ts` — load + Zod-validate the compact model; scale in float64 → `Math.fround`; per tree, leaf index = Σ `(fround(x[f]) > fround(border)) << depth`; accumulate `leaves[leaf * nClasses + c]`; apply scale/bias; softmax. Return `{ recommendation, model_score, alternatives(top 3) }`. Cache the parsed model at module scope.
**New:** `lib/catboost-applier.test.ts` — golden file: 2,200/2,200 labels match, probabilities within 1e-5; `lib/frozen-samples.ts` all return `expected`; held-out accuracy recomputed from the golden file equals the manifest.
**Contingency:** if exact agreement cannot be reached, switch to `model.save_model(format="onnx")` + `onnxruntime-web` (wasm). Same route wiring.

### A3. Route wiring
**Modify:** `app/api/v1/predictions/crop/route.ts`, `model-metadata/route.ts`, `readiness/route.ts`.
Resolution order: `FASTAPI_BASE_URL` → proxy (unchanged) · else native model loads → serve it · else fixture (unchanged).
Native response: `model_version` from manifest, `score_kind: "uncalibrated_model_score"`, `explanations: []`, warnings from `envelopeWarnings` only. Metadata reports `status: "production"` and the measured accuracy. Readiness `ready` when native or FastAPI serves. Log `"model": "catboost-native"`.

---

## Part B — Irrigation decision: retrain, export, serve

### B1. Retrain (faithful to thesis cell 117)
**New:** `mlops/train_irrigation_model.py`.
- `Data/cropdata_updated 3.csv` → lowercase/rename columns as the notebook does (`crop ID`→`crop_id`, `Seedling Stage`→`seedling_stage`, `MOI`→`moi`).
- `y = (result == 1)`; stratified 80/20, seed 42.
- Same pipeline: `ColumnTransformer(StandardScaler on [moi,temp,humidity], OneHotEncoder on [crop_id,soil_type,seedling_stage])` + `XGBClassifier(n_estimators=400, max_depth=6, learning_rate=0.1, tree_method="hist", random_state=42, eval_metric="logloss")`. Keep `handle_unknown="ignore"` for fidelity — the TypeScript contract is what rejects unknown categories before they reach the model.
- Report accuracy/precision/recall/F1/MCC/AUC; expect 0.9997. Record whatever is measured.
- Write `artifacts/irrigation_pipeline.joblib` (gitignored by existing rule), `artifacts/irrigation-xgboost.model.json` (compact: category vocabularies, scaler mean/scale, one-hot column order, trees as `{nodes: [{feature, threshold, left, right, defaultLeft, leaf}]}` from `booster.save_model(json)`, `base_score`), `artifacts/irrigation-golden.json` (all 16,411 rows).
- Write `artifacts/irrigation-manifest.json` (same schema as the crop manifest) with **`label_mapping` field**: `{ "0": "do_not_irrigate", "1": "irrigate", "2": "mapped_to_0 (1,122 rows, 6.8%; thesis §4.1.12 treats the task as binary)" }`.
- Any figure written (confusion matrix, ROC) → `artifacts/figures/irrigation-confusion-matrix.png`, unnumbered title.

### B2. Applier + contract
**New:** `lib/xgboost-applier.ts` — one-hot + scale, traverse each tree (`x < threshold` → left, missing → `defaultLeft`), sum leaves + base margin, sigmoid.
**New:** `lib/xgboost-applier.test.ts` — 16,411/16,411 golden agreement.
**Modify:** `lib/contracts.ts` — add `irrigationRequestSchema` (`crop: enum[5]`, `soil_type: enum[7]`, `growth_stage: enum[8]`, `moisture_pct: 1–100`, `temperature_c`, `humidity_pct`), `irrigationEnvelope` (temp 13–46, humidity 15–91 from the data), `irrigationResponseSchema` (`decision: "irrigate" | "do_not_irrigate"`, `model_score`, `score_kind`, `warnings`, `model_version`, `schema_version`, `request_id`, `predicted_at`).
**Modify:** `lib/api-client.ts` — `predictIrrigation()`.
**Modify:** `lib/manifest.ts`, `mlops/verify-manifest.mjs` — accept a list of manifests; verify both.

### B3. Route + page
**New:** `app/api/v1/predictions/irrigation/route.ts` (same three-way resolution; no fixture — returns 503 `model_unavailable` if the artefact is absent).
**New:** `app/irrigate/page.tsx`, `components/irrigate-page.tsx`, `components/irrigation-form.tsx` — three `<select>`s (crop, soil, stage) + three number inputs, envelope warnings, result card ("Irrigate now" / "Not now" with score labelled as model score), then the guidance block (Part C) for that crop.
**Modify:** `components/site-header.tsx`, `lib/content.ts` — nav item "Irrigate" / "Water" (pcm); all new strings in both locales.
**Modify:** `components/research-page.tsx`, `lib/research-data.ts` — irrigation is no longer "withheld": show the served model's metrics, the label-2 disclosure, the five-crop scope, and the no-overlap fact. Reconcile the leaderboard with `all_17_models_comparison.csv`.

---

## Part C — Watering guidance module (rule-based, researched, labelled)

### C1. Knowledge base
**New:** `lib/irrigation-guidance/crops.ts` — one entry per crop for **all 27 crops** (22 recommender + 5 irrigation). Each entry, typed so a missing field fails `tsc`:
- `waterNeed`: low | moderate | high | flooded (rice)
- `rootingDepth`: shallow | medium | deep (drives how much the soil can hold between waterings)
- `stages`: per growth stage, FAO-56 crop coefficient `kc` and a `sensitivity` note (e.g. flowering = critical)
- `intervalDays`: dry-season baseline by soil texture `{ sandy, loam, clay }`
- `timeOfDay`: guidance + reason (evaporation, fungal risk)
- `rainRule`: `{ skipDaysAfterMm: [[10, 1], [25, 3]] }` style thresholds
- `waterlogging`: risk note where relevant (pulses, papaya, watermelon)
- `stageNotes`: e.g. rice: drain 2 weeks before harvest; maize: tasselling critical
- `sources[]`: citations with URL

**Research plan (done during implementation, with web search):** FAO Irrigation & Drainage Paper 56 (Kc tables, rooting depths), FAO "Crop Water Information" pages, FAO Irrigation Water Management Training Manuals 3–4 (scheduling), IITA and NAERLS crop production guides for Nigerian practice, CABI Crop Protection Compendium for waterlogging/disease notes. Every entry cites what it was drawn from. Where a Nigeria-specific source exists it is preferred over a generic one.

### C2. Schedule engine
**New:** `lib/irrigation-guidance/schedule.ts` — pure, deterministic:
`buildSchedule({ crop, growthStage, soilTexture, season: "dry" | "wet", recentRainMm?, temperatureC?, humidityPct? }) → { frequency, timeOfDay, afterRain, warnings[], basis[] }`
- Interval = baseline for soil texture × stage Kc adjustment × heat adjustment (temp > 32 °C and humidity < 50 % shortens it), clamped to sane bounds.
- `afterRain` from the crop's rain thresholds and `recentRainMm` (when the Uyo observation is available, its `rain_1h_mm` is offered as a *suggested* input, never auto-applied — same rule as the prediction form).
- Every output line carries a `basis` string ("FAO-56 Kc mid-season 1.20 for maize; loam baseline 4 days; +heat") so the UI can show *why*.
**New:** `lib/irrigation-guidance/schedule.test.ts` — bounds, monotonicity (sandy < loam < clay intervals), rain skips, every crop produces a schedule for every stage.
**New:** `lib/irrigation-guidance/crops.test.ts` — all 27 crops present, both locales, every source has a URL.

### C3. UI
**New:** `components/watering-guidance.tsx` — rendered under the `/predict` result (for the recommended crop) and under the `/irrigate` result. Fixed kicker: **"Extension guidance, not a model prediction."** Shows frequency / time of day / after rain / watch-for / stage note, a "why this advice" expander listing `basis`, and the sources. Growth stage and soil texture are two small selects inside the block so the user can refine.
**Modify:** `components/prediction-form.tsx` — mount the guidance block after a result. `lib/content.ts` — all labels in en + pcm.
**Modify:** `components/research-page.tsx` — a section stating that watering schedules are authored, rule-based guidance with sources, separate from both models.

---

## Part D — Bookkeeping

- `.gitignore`: add `artifacts/smart_farming_bundle/`, keep `*.joblib` excluded; allow `artifacts/*.cbm` and `artifacts/*.json`.
- `mlops/README.md`, `CLAUDE.md`: three serving modes; two models; the label-2 disclosure; the no-overlap fact; guidance is not ML; figure-naming rule.
- `lib/frozen-samples.ts`: unchanged; applier test asserts `expected`.
- E2E: `tests/e2e/prediction.spec.ts`, `navigation.spec.ts` assertions on the fixture warning → production state. New `tests/e2e/irrigation.spec.ts` (both locales, unknown-category rejection, guidance block visible, axe). Re-record visual baselines.
- Memory (after plan mode): "figures never numbered", "irrigation labels: match thesis, disclose", "no crop overlap between the two models".

## Verification
1. `uv run … mlops/export_crop_model.py` → prints 0.997727; aborts otherwise.
2. `uv run … mlops/train_irrigation_model.py` → prints ≈0.9997; manifests written.
3. `pnpm verify:manifest` → both manifests verified, 3 artefacts checksummed.
4. `pnpm test` → golden tests 2,200/2,200 and 16,411/16,411; frozen samples rice/mothbeans/papaya recovered; guidance covers 27 crops.
5. `pnpm dev`: POST mothbeans row → `"mothbeans"`, no fixture warning. POST `{crop:"Wheat", soil_type:"Black Soil", growth_stage:"Germination", moisture_pct:2, temperature_c:26, humidity_pct:77}` → `"irrigate"`. POST `crop:"Cassava"` → 422.
6. `/research` status panel → "Production model" for both; leaderboard matches the CSV.
7. `pnpm test:e2e` → green; `pnpm build` → route bundles stay well under Vercel's function limit (≈6 MB + ≈1 MB of model JSON).

# MLOps: training, export and release

Two models are served, both as compact JSON tree files evaluated by TypeScript
appliers inside the Next.js API routes. No Python runs in production.

| Task | Model | Held-out | Artefact |
|---|---|---|---|
| Crop recommendation (22 classes) | CatBoost, default params, seed 42 | 0.997727 (439/440) | `artifacts/crop-catboost.model.json` |
| Irrigation decision (binary) | ColumnTransformer + XGBoost, thesis cell 117 | 0.999391 (3,281/3,283) | `artifacts/irrigation-xgboost.model.json` |

## Where things live

- **Training** happens in Google Colab in `Notebooks/Smart_farming_for_rural_Nigeria_ALL17 (7).ipynb`. The Colab layout (`/content/data`, `/content/models`, `/content/figures`) is unchanged.
- **Export** logic is `mlops/web_export.py`. It is embedded verbatim into the notebook's Section 24 by `mlops/sync_notebook.py`, so Colab and local runs produce identical artefacts. Edit the `.py`, then re-run the sync; never edit the notebook cell by hand.
- **Local export** from a Colab bundle: `uv run --python 3.12 --with-requirements mlops/requirements.txt python mlops/export_local.py` (add `--train-irrigation` to retrain irrigation locally with the thesis recipe when the bundle has no `irrigation_pipeline.joblib`).
- **Release gate**: `pnpm verify:manifest` (`mlops/verify-manifest.mjs`) checks every `artifacts/*-manifest.json` for consistency and SHA-256 agreement. CI runs it.

## The round trip with Colab

1. Retrain in Colab; run Section 24 at the end. It downloads `smart_farming_web_export.zip`.
2. Unzip it. Install the export with:

   ```
   uv run --python 3.12 --with-requirements mlops/requirements.txt \
       python mlops/install_export.py <unzipped>/web_export
   ```

   This copies the artefacts, rewrites their paths, stamps the real git revision, re-verifies every checksum, and replays both goldens through the reference appliers.
3. Optionally copy `saved_models/` and `figures/` into `artifacts/smart_farming_bundle/` (gitignored) for reference.
4. `pnpm test` — the golden-file tests replay every training row (2,200 and 16,411) through the TypeScript appliers.
5. Commit the regenerated `artifacts/*.json` and `crop-catboost.cbm`.

### Install the Colab export; do not re-export from the joblib

`mlops/export_local.py` exists for development only. Re-exporting a `.joblib` on a
different machine is **not** equivalent to the Colab export: unpickling an
XGBoost model under a different library version can silently produce a different
predictor. On the 2026-09-22 bundle the Colab irrigation pipeline, reloaded under
xgboost 2.1.4, disagreed with its own golden file by up to **0.12 in probability**
and reported an optimistic 3,282/3,283 instead of the true 3,281/3,283. Always
use `install_export.py` for a real Colab run.

### Accuracy note

The dissertation reports 3,282/3,283 (99.97%) for the irrigation classifier. The
served artefact from the 2026-09-22 run makes one more error, 3,281/3,283
(99.94%), which is ordinary variation between library builds. The site reports
the measured value, and `lib/research-data.ts` records both.

## Export invariants

Before any artefact is written, `web_export.py` runs a pure-numpy reference applier over the compact format and requires label agreement 1.0 and max |Δp| ≤ 1e-5 against the library on every row. The TypeScript appliers (`lib/catboost-applier.ts`, `lib/xgboost-applier.ts`) are line-for-line ports of those reference appliers.

Two model properties the appliers must preserve:

- CatBoost compares features against borders in **float32** (`Math.fround`).
- The irrigation `ColumnTransformer` emits a **sparse** matrix, so XGBoost was trained seeing one-hot zeros (and exactly-zero scaled values) as *missing*, routed by `default_left`. The applier encodes zeros as NaN to match. Getting this wrong drops agreement to 93%.

## Irrigation labels — disclosure

The Smart Agriculture Dataset's `result` column has three values: 0 (9,062 rows), 1 (6,227) and 2 (1,122; 6.8%). Dissertation §4.1.12 evaluates a binary model and never mentions label 2. The served model matches the thesis: `y = (result == 1)`, so label 2 is mapped to "do not irrigate". This is recorded in `irrigation-manifest.json` (`label_mapping`, `label_2_rows_mapped_to_0`), reported by `/api/v1/model-metadata`, and shown on the research page. Changing it would make the served model diverge from the submitted dissertation.

## Scope facts stated on the site

- The five irrigation crops (Carrot, Chilli, Potato, Tomato, Wheat) do not overlap the 22 recommender crops. The tools cannot chain.
- The API accepts only the training vocabulary and moisture 1-100; the thesis pipeline's `handle_unknown="ignore"` would otherwise accept unknown categories silently.
- Watering schedules (`lib/irrigation-guidance/`) are authored, rule-based guidance from FAO-56 and FAO Training Manuals 3-4, not a model. Every crop lists its sources.

## Still gated

- **Per-input explanations** stay `[]`. The published SHAP ranking was computed on the tuned XGBoost, not CatBoost. Compute SHAP on the served `.cbm`, verify against `lib/frozen-samples.ts`, then enable.
- **Calibration**: both models report `uncalibrated_model_score`. Evaluate probability calibration before presenting any percentage as confidence.
- **FastAPI**: `FASTAPI_BASE_URL` still proxies both prediction routes upstream if set; no such service exists in this repo.

## Figures

Any figure the notebook writes uses a descriptive filename with no number (`crop_class_distribution.png`, not `figure_01_…`). `save_fig` in the notebook enforces this.

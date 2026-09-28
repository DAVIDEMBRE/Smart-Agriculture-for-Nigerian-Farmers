"""
Apply the web-deployment edits to the training notebook.

    python3 mlops/sync_notebook.py "Notebooks/Smart_farming_for_rural_Nigeria_ALL17 (7).ipynb"

Idempotent: running it twice produces the same notebook. Edits:

1. `save_fig` writes descriptive filenames with no figure numbers.
2. The OpenWeatherMap key is read from the environment or prompted for, never
   stored in the notebook.
3. The end-to-end irrigation demo uses categories the model was trained on and
   a moisture value inside the observed 1-100 range, with no silent fallback.
4. A "Export for the web application" section is appended (or replaced) that
   embeds `mlops/web_export.py` verbatim, runs both exports, and zips the
   deliverables for download.

The cells this script owns carry a `web-export` tag in their metadata, which is
how a re-run finds and replaces them.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT_MODULE = ROOT / "mlops" / "web_export.py"

TAG_MODULE = "web-export-module"
TAG_RUN = "web-export-run"
TAG_ZIP = "web-export-zip"
TAG_MD = "web-export-markdown"


def cell(kind: str, source: str, tag: str | None = None) -> dict:
    c = {
        "cell_type": kind,
        "metadata": {"tags": [tag]} if tag else {},
        "source": source.splitlines(keepends=True),
    }
    if kind == "code":
        c["execution_count"] = None
        c["outputs"] = []
    return c


def src(c: dict) -> str:
    return "".join(c["source"])


def set_src(c: dict, text: str) -> None:
    c["source"] = text.splitlines(keepends=True)
    if c["cell_type"] == "code":
        c["outputs"] = []
        c["execution_count"] = None


# --------------------------------------------------------------------------
# 1. figure names without numbers
# --------------------------------------------------------------------------


def fix_figure_numbering(cells: list[dict]) -> int:
    changed = 0
    for c in cells:
        if c["cell_type"] != "code":
            continue
        text = src(c)
        new = text.replace(
            'fname = FIG_DIR / f"figure_{n:02d}_{name}.png"',
            'fname = FIG_DIR / f"{name}.png"  # descriptive name, no figure number',
        )
        new = new.replace(
            '"""Save current matplotlib figure with auto-numbering, then offer download."""',
            '"""Save the current matplotlib figure under a descriptive name, then offer download."""',
        )
        new = re.sub(r'FIG_DIR / "figure_\d+_([a-z0-9_]+)\.(png|html)"', r'FIG_DIR / "\1.\2"', new)
        if new != text:
            set_src(c, new)
            changed += 1
    return changed


# --------------------------------------------------------------------------
# 2. API key out of the notebook
# --------------------------------------------------------------------------

KEY_LINE = re.compile(r'^OWM_API_KEY\s*=\s*"[0-9a-fA-F]{32}".*$', re.M)
KEY_REPLACEMENT = (
    "import os, getpass\n"
    "# The key is never stored in this notebook. Set OWM_API_KEY in the environment\n"
    "# (Colab: the key icon in the left sidebar → add secret → os.environ) or paste\n"
    "# it at the prompt; it is used for this session only.\n"
    'OWM_API_KEY = os.environ.get("OWM_API_KEY") or getpass.getpass("OpenWeatherMap API key: ")'
)


def scrub_api_key(cells: list[dict]) -> int:
    changed = 0
    for c in cells:
        if c["cell_type"] != "code":
            continue
        text = src(c)
        if KEY_LINE.search(text):
            set_src(c, KEY_LINE.sub(KEY_REPLACEMENT, text))
            changed += 1
    return changed


# --------------------------------------------------------------------------
# 3. irrigation demo with valid inputs
# --------------------------------------------------------------------------

DEMO_MARKER = "# Irrigation decision for each demo reading"
DEMO_CELL = '''# Irrigation decision for each demo reading
#
# The irrigation model was trained on five crops (Carrot, Chilli, Potato,
# Tomato, Wheat), seven soil types and eight growth stages, and on a moisture
# index observed between 1 and 100. None of the 22 recommender crops is among
# the five, so the two models cannot be chained on the same crop; the demo
# therefore pairs each reading with a supported crop and states that plainly.
# Inputs outside the training vocabulary are an error, never a silent fallback.
IRR_CROPS  = list(irrigation_r.named_steps["prep"].named_transformers_["cat"].categories_[0])
IRR_SOILS  = list(irrigation_r.named_steps["prep"].named_transformers_["cat"].categories_[1])
IRR_STAGES = list(irrigation_r.named_steps["prep"].named_transformers_["cat"].categories_[2])

demo_irrigation = [
    # (crop,     soil,          stage,                 moisture index 1-100)
    ("Wheat",    "Black Soil",  "Germination",         3),
    ("Tomato",   "Loam Soil",   "Flowering",           55),
    ("Potato",   "Sandy Soil",  "Vegetative Growth / Root or Tuber Development", 85),
]

print("IRRIGATION DECISION RESULTS")
print("=" * 60)
for i, ((crop, soil, stage, moi), row, rec) in enumerate(zip(demo_irrigation,
                                                            sensor_readings.itertuples(index=False),
                                                            crop_names)):
    for value, allowed, what in ((crop, IRR_CROPS, "crop"), (soil, IRR_SOILS, "soil type"), (stage, IRR_STAGES, "growth stage")):
        if value not in allowed:
            raise ValueError(f"{what} {value!r} is not in the irrigation training vocabulary: {allowed}")
    if not 1 <= moi <= 100:
        raise ValueError("moisture index must be within the observed 1-100 range")

    irr_input = pd.DataFrame([{
        "crop_id":        crop,
        "soil_type":      soil,
        "seedling_stage": stage,
        "moi":            moi,
        "temp":           row.temperature,
        "humidity":       row.humidity,
    }])
    decision  = int(irrigation_r.predict(irr_input)[0])
    proba_yes = float(irrigation_r.predict_proba(irr_input)[0][1])
    label = "IRRIGATE NOW" if decision == 1 else "DO NOT IRRIGATE"
    print(f"\\nReading {i+1}  →  recommended crop: {rec}  (not an irrigation-model crop)")
    print(f"             irrigation check for {crop:<8s} / {soil} / {stage} / moisture {moi}")
    print(f"             decision: {label}  (p_irrigate={proba_yes:.3f})")
'''


def fix_irrigation_demo(cells: list[dict]) -> int:
    for c in cells:
        if c["cell_type"] == "code" and src(c).startswith(DEMO_MARKER):
            if src(c) != DEMO_CELL:
                set_src(c, DEMO_CELL)
                return 1
            return 0
    return 0


# --------------------------------------------------------------------------
# 4. export section
# --------------------------------------------------------------------------

MARKDOWN = """# SECTION 24 — Export for the web application

The website serves both models from compact JSON tree files evaluated by a small
TypeScript applier, so no Python runs in production. This section:

1. Embeds `mlops/web_export.py` from the repository **verbatim** — do not edit it
   here; edit the file and re-run `python3 mlops/sync_notebook.py`.
2. Converts the fitted CatBoost and the irrigation pipeline, checks a reference
   applier against the library on every training row, and writes the model JSON,
   a golden-prediction file, and a manifest with SHA-256 checksums.
3. Zips `web_export/`, `models/`, `figures/` and the comparison table for download.

**Send the resulting `smart_farming_web_export.zip` to the web repository.**
"""

RUN_CELL = '''# Run the export against this session's fitted objects.
# Falls back to the saved .joblib files if the objects are not in memory, so this
# cell also works in a fresh session after re-running the "reload" cell above.
import subprocess
WEB_EXPORT_DIR = Path("/content/web_export") if IN_COLAB else (MODEL_DIR.parent / "web_export")
WEB_EXPORT_DIR.mkdir(parents=True, exist_ok=True)

def _get(name, fallback_path):
    obj = globals().get(name)
    return obj if obj is not None else joblib.load(fallback_path)

_catboost = fitted_classical["CatBoost"] if "fitted_classical" in globals() and "CatBoost" in fitted_classical \\
            else joblib.load(MODEL_DIR / "classical_catboost.joblib")
_scaler   = _get("scaler",  MODEL_DIR / "scaler.joblib")
_le       = _get("le",      MODEL_DIR / "label_encoder.joblib")
_irr      = _get("irrigation_pipeline", MODEL_DIR / "irrigation_pipeline.joblib")

_crop_csv  = next(DATA_DIR.glob("Crop_recommendation*.csv"))
_smart_csv = next(p for p in DATA_DIR.glob("*.csv")
                  if "result" in [c.strip().lower() for c in pd.read_csv(p, nrows=1).columns])
_crop_df   = crop_df if "crop_df" in globals() else pd.read_csv(_crop_csv)
_smart_df  = smart_df if "smart_df" in globals() else load_smart_agriculture(_smart_csv)

_revision = os.environ.get("EXPORT_GIT_REVISION", f"colab-run-{now_iso()}")

crop_manifest = export_crop_model(
    model=_catboost, scaler=_scaler, label_encoder=_le, crop_df=_crop_df,
    dataset_csv=_crop_csv, out_dir=WEB_EXPORT_DIR, root=WEB_EXPORT_DIR.parent,
    git_revision=_revision, trained_at=now_iso(), seed=SEED,
)
irrigation_manifest = export_irrigation_model(
    pipeline=_irr, smart_df=_smart_df, dataset_csv=_smart_csv,
    out_dir=WEB_EXPORT_DIR, root=WEB_EXPORT_DIR.parent,
    git_revision=_revision, trained_at=now_iso(), seed=SEED,
)
print("\\nExported to", WEB_EXPORT_DIR)
for p in sorted(WEB_EXPORT_DIR.iterdir()):
    print(f"  {p.name:<34s} {p.stat().st_size/1e6:7.2f} MB")
'''

ZIP_CELL = '''# Package everything the web repository needs into one archive and download it.
import shutil
_bundle_root = WEB_EXPORT_DIR.parent / "smart_farming_web_export"
if _bundle_root.exists():
    shutil.rmtree(_bundle_root)
_bundle_root.mkdir()

shutil.copytree(WEB_EXPORT_DIR, _bundle_root / "web_export")
shutil.copytree(MODEL_DIR,      _bundle_root / "models")
shutil.copytree(FIG_DIR,        _bundle_root / "figures")
_cmp = next((p for p in [FIG_DIR.parent / "all_17_models_comparison.csv", MODEL_DIR / "all_17_models_comparison.csv"] if p.exists()), None)
if _cmp is not None:
    shutil.copy(_cmp, _bundle_root / "all_17_models_comparison.csv")
elif "results" in globals():
    pd.DataFrame(results).to_csv(_bundle_root / "all_17_models_comparison.csv", index=False)

_zip = shutil.make_archive(str(_bundle_root), "zip", root_dir=_bundle_root)
print("Archive:", _zip, f"({Path(_zip).stat().st_size/1e6:.1f} MB)")
if IN_COLAB:
    files.download(_zip)
'''


def upsert_export_section(cells: list[dict]) -> int:
    module_source = EXPORT_MODULE.read_text(encoding="utf-8")
    module_cell_source = (
        "# ---- mlops/web_export.py (embedded verbatim by mlops/sync_notebook.py; do not edit here) ----\n"
        + module_source
    )

    wanted = [
        (TAG_MD, "markdown", MARKDOWN),
        (TAG_MODULE, "code", module_cell_source),
        (TAG_RUN, "code", RUN_CELL),
        (TAG_ZIP, "code", ZIP_CELL),
    ]

    changed = 0
    by_tag = {}
    for c in cells:
        for tag in c.get("metadata", {}).get("tags", []):
            by_tag[tag] = c

    # Insert before the closing-notes markdown if the section does not exist yet.
    closing_index = next(
        (i for i, c in enumerate(cells) if c["cell_type"] == "markdown" and "Closing Notes" in src(c)),
        len(cells),
    )

    insert_at = closing_index
    for tag, kind, text in wanted:
        existing = by_tag.get(tag)
        if existing is None:
            cells.insert(insert_at, cell(kind, text, tag))
            insert_at += 1
            changed += 1
        else:
            if src(existing) != text:
                set_src(existing, text)
                changed += 1
            insert_at = cells.index(existing) + 1
    return changed


def update_closing_notes(cells: list[dict]) -> int:
    for c in cells:
        if c["cell_type"] == "markdown" and "Closing Notes" in src(c):
            text = src(c)
            line = "\n\nThe final section exports both models to the compact JSON format the website serves, verifies a reference applier against the library on every row, and packages the deliverables as `smart_farming_web_export.zip`."
            if line.strip() not in text:
                set_src(c, text.rstrip() + line + "\n")
                return 1
    return 0


def main(path: str) -> int:
    nb_path = Path(path)
    nb = json.loads(nb_path.read_text(encoding="utf-8"))
    cells = nb["cells"]

    report = {
        "figure numbering": fix_figure_numbering(cells),
        "api key scrubbed": scrub_api_key(cells),
        "irrigation demo": fix_irrigation_demo(cells),
        "export section": upsert_export_section(cells),
        "closing notes": update_closing_notes(cells),
    }

    nb_path.write_text(json.dumps(nb, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for name, count in report.items():
        print(f"{name:<18s} {count} cell(s) changed")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1]))

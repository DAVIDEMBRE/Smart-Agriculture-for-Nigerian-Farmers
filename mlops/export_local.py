"""
Local export runner.

Reads the trained artefacts (the Colab bundle, or a local irrigation retrain)
and writes the web-serving artefacts into `artifacts/` using `web_export.py`.

    uv run --python 3.12 --with-requirements mlops/requirements.txt mlops/export_local.py

Options:
    --bundle DIR      directory holding classical_catboost.joblib, scaler.joblib,
                      label_encoder.joblib and (optionally) irrigation_pipeline.joblib
                      (default: artifacts/smart_farming_bundle/saved_models)
    --train-irrigation  retrain the irrigation pipeline locally with the thesis
                      recipe when the bundle has no irrigation_pipeline.joblib
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib

sys.path.insert(0, str(Path(__file__).resolve().parent))
import web_export as wx  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts"


def git_revision() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short=12", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return "unknown"


def file_mtime_iso(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", default=str(OUT / "smart_farming_bundle" / "saved_models"))
    parser.add_argument("--train-irrigation", action="store_true")
    args = parser.parse_args()
    bundle = Path(args.bundle)

    import pandas as pd

    rev = git_revision()

    # --- crop recommender -------------------------------------------------
    model = joblib.load(bundle / "classical_catboost.joblib")
    scaler = joblib.load(bundle / "scaler.joblib")
    label_encoder = joblib.load(bundle / "label_encoder.joblib")
    crop_csv = ROOT / "Data" / "Crop_recommendation.csv"
    crop_df = pd.read_csv(crop_csv)

    wx.export_crop_model(
        model=model,
        scaler=scaler,
        label_encoder=label_encoder,
        crop_df=crop_df,
        dataset_csv=crop_csv,
        out_dir=OUT,
        root=ROOT,
        git_revision=rev,
        trained_at=file_mtime_iso(bundle / "classical_catboost.joblib"),
    )

    # --- irrigation decision ----------------------------------------------
    smart_csv = ROOT / "Data" / "cropdata_updated 3.csv"
    smart_df = wx.load_smart_agriculture(smart_csv)
    # Prefer the Colab artefact; fall back to a previous local retrain.
    candidates = [bundle / "irrigation_pipeline.joblib", OUT / "irrigation_pipeline.joblib"]
    irrigation_path = next((p for p in candidates if p.exists()), candidates[0])

    if irrigation_path.exists():
        pipeline = joblib.load(irrigation_path)
        trained_at = file_mtime_iso(irrigation_path)
        print(f"Irrigation pipeline loaded from {irrigation_path}")
    elif args.train_irrigation:
        print("No irrigation_pipeline.joblib in the bundle; retraining with the thesis recipe.")
        pipeline = wx.train_irrigation_pipeline(smart_df)
        trained_at = wx.now_iso()
        joblib.dump(pipeline, OUT / "irrigation_pipeline.joblib")
        print(f"Saved {OUT / 'irrigation_pipeline.joblib'}")
    else:
        print("No irrigation_pipeline.joblib found and --train-irrigation not given; skipping irrigation.")
        return 0

    wx.export_irrigation_model(
        pipeline=pipeline,
        smart_df=smart_df,
        dataset_csv=smart_csv,
        out_dir=OUT,
        root=ROOT,
        git_revision=rev,
        trained_at=trained_at,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

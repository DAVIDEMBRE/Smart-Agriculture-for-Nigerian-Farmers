"""
Install a Colab `web_export/` directory into `artifacts/`.

    uv run --python 3.12 --with-requirements mlops/requirements.txt \
        python mlops/install_export.py "artifacts/updated artifacts/smart_farming_web_export/web_export"

Use this, not `export_local.py`, whenever a Colab run has produced its own
export. The exported `*.model.json` is authoritative: it was written in the same
session that fitted the model, by the same library versions, and its reference
applier verified agreement on every training row there.

Re-exporting from the `.joblib` on a different machine is **not** equivalent.
Unpickling an XGBoost model under a different version than pickled it can
silently yield a different predictor: on the 2026-09-22 bundle, the Colab
pipeline reloaded under xgboost 2.1.4 disagreed with its own golden file by up
to 0.12 in probability. This script therefore copies the exported artefacts
verbatim and only:

  * rewrites `artifacts.*.path` to the repository-relative install path,
  * stamps the real git revision (keeping Colab's `trained_at`),
  * recomputes and re-verifies every SHA-256 against the installed file,
  * re-runs the reference appliers against the installed goldens.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import web_export as wx  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"

MANIFESTS = {
    "crop-manifest.json": "crop_recommendation",
    "irrigation-manifest.json": "irrigation_decision",
}


def git_revision() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short=12", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return "unknown"


def verify_crop(artifacts: Path) -> None:
    compact = json.loads((artifacts / "crop-catboost.model.json").read_text())
    golden = json.loads((artifacts / "crop-golden.json").read_text())
    X = np.array([row["input"] for row in golden["rows"]], dtype=np.float64)
    expected = np.array([row["proba"] for row in golden["rows"]], dtype=np.float64)
    actual = wx.catboost_reference_predict_proba(compact, X)
    agree = float(np.mean(actual.argmax(1) == expected.argmax(1)))
    delta = float(np.max(np.abs(actual - expected)))
    print(f"crop        : {len(golden['rows'])} rows, label agreement {agree:.6f}, max |Δp| {delta:.2e}")
    if agree < 1.0 or delta > 1e-5:
        raise SystemExit("crop export does not reproduce its own golden file")


def verify_irrigation(artifacts: Path) -> None:
    import pandas as pd

    compact = json.loads((artifacts / "irrigation-xgboost.model.json").read_text())
    golden = json.loads((artifacts / "irrigation-golden.json").read_text())
    frame = pd.DataFrame(
        [
            {**dict(zip(wx.IRR_CAT, row["categorical"])), **dict(zip(wx.IRR_NUM, row["numeric"]))}
            for row in golden["rows"]
        ]
    )
    expected = np.array([row["proba_irrigate"] for row in golden["rows"]], dtype=np.float64)
    actual = wx.xgboost_reference_predict_proba(compact, frame)
    agree = float(np.mean((actual >= 0.5) == (expected >= 0.5)))
    delta = float(np.max(np.abs(actual - expected)))
    labels = np.array([row["label"] for row in golden["rows"]], dtype=int)
    errors = int(((actual >= 0.5).astype(int) != labels).sum())
    print(f"irrigation  : {len(golden['rows'])} rows, label agreement {agree:.6f}, max |Δp| {delta:.2e}, {errors} error(s) vs source labels")
    if agree < 1.0 or delta > 1e-5:
        raise SystemExit("irrigation export does not reproduce its own golden file")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="the Colab web_export directory")
    args = parser.parse_args()
    source = Path(args.source)
    if not source.is_dir():
        raise SystemExit(f"{source} is not a directory")

    revision = git_revision()
    copied: list[str] = []

    for name in sorted(p.name for p in source.iterdir() if p.is_file()):
        if name in MANIFESTS:
            continue
        shutil.copy2(source / name, ARTIFACTS / name)
        copied.append(name)
    print("installed:", ", ".join(copied))

    for manifest_name, task in MANIFESTS.items():
        manifest = json.loads((source / manifest_name).read_text())
        if manifest.get("task") != task:
            raise SystemExit(f"{manifest_name} declares task {manifest.get('task')!r}, expected {task!r}")
        if manifest.get("status") != "production":
            raise SystemExit(f"{manifest_name} is not a production manifest")

        manifest["git_revision"] = revision
        manifest["exported_in"] = "google-colab"

        for key, ref in manifest["artifacts"].items():
            filename = Path(ref["path"]).name
            installed = ARTIFACTS / filename
            if not installed.exists():
                raise SystemExit(f"{manifest_name}: {filename} was not in {source}")
            digest = wx.sha256_file(installed)
            if ref.get("sha256") and ref["sha256"] != digest:
                raise SystemExit(f"{manifest_name}: {filename} changed in transit (checksum mismatch)")
            ref["path"] = f"artifacts/{filename}"
            ref["sha256"] = digest

        wx.write_json(ARTIFACTS / manifest_name, manifest)
        print(f"{manifest_name}: trained_at {manifest['trained_at']}, held-out {manifest['metrics']['held_out_accuracy']}")

    print()
    verify_crop(ARTIFACTS)
    verify_irrigation(ARTIFACTS)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

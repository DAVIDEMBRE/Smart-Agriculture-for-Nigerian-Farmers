"""
Export the trained models into the compact formats the web application serves.

This module is the single source of truth for the export. The same code is
embedded verbatim into the training notebook (see `mlops/sync_notebook.py`) so
a Colab run and a local run produce byte-identical artefacts.

Two models are exported:

* Crop recommender — CatBoost (22 classes), plus the StandardScaler and
  LabelEncoder it was trained with.
* Irrigation decision — the scikit-learn Pipeline (ColumnTransformer + XGBoost)
  from the thesis, binary.

For each model the export writes:

* `<name>.model.json` — a compact tree format that a ~100-line applier can
  evaluate with no ML runtime.
* `<name>-golden.json` — every training row with the library's own class
  probabilities and predicted label. This is the oracle the TypeScript applier
  is tested against.
* `<name>-manifest.json` — provenance, metrics and SHA-256 checksums.

Before anything is written, a pure-Python reference applier evaluates the
compact format and must agree with the library on every row. If it does not,
the export aborts: a format the reference applier cannot reproduce is not one
the web application can serve.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

EXPORT_SCHEMA_VERSION = "1.0.0"

CROP_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
CROP_FEATURES_WEB = [
    "nitrogen",
    "phosphorus",
    "potassium",
    "temperature_c",
    "humidity_pct",
    "soil_ph",
    "rainfall_mm",
]

IRR_CAT = ["crop_id", "soil_type", "seedling_stage"]
IRR_NUM = ["moi", "temp", "humidity"]
IRR_CAT_WEB = ["crop", "soil_type", "growth_stage"]
IRR_NUM_WEB = ["moisture_pct", "temperature_c", "humidity_pct"]

# The thesis (§4.1.12) treats irrigation as binary. The source column has three
# values; this is the mapping the notebook applied and the manifest discloses.
IRRIGATION_LABEL_MAPPING = {
    "0": "do_not_irrigate",
    "1": "irrigate",
    "2": "mapped_to_0 (thesis §4.1.12 evaluates the task as binary; 1,122 rows, 6.8%)",
}


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def b64_f32(values) -> str:
    """Float32, little-endian, base64. Compact and exact enough for tree leaves."""
    return base64.b64encode(np.asarray(values, dtype="<f4").tobytes()).decode("ascii")


def b64_f64(values) -> str:
    return base64.b64encode(np.asarray(values, dtype="<f8").tobytes()).decode("ascii")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def softmax(raw: np.ndarray) -> np.ndarray:
    z = raw - raw.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)


# --------------------------------------------------------------------------
# CatBoost: compact format + reference applier
# --------------------------------------------------------------------------


def catboost_to_compact(model, scaler, label_encoder) -> dict:
    """Convert a fitted CatBoostClassifier to the compact oblivious-tree format."""
    with tempfile.TemporaryDirectory() as tmp:
        raw_path = os.path.join(tmp, "catboost.json")
        model.save_model(raw_path, format="json")
        with open(raw_path, encoding="utf-8") as f:
            raw = json.load(f)

    float_features = raw["features_info"]["float_features"]
    if any(ff.get("nan_value_treatment", "AsIs") != "AsIs" for ff in float_features):
        raise RuntimeError("Model uses NaN-aware splits; the compact applier does not support them.")
    if raw["features_info"].get("categorical_features"):
        raise RuntimeError("Model uses categorical features; the compact applier is numeric-only.")
    flat_index = {ff["feature_index"]: ff["flat_feature_index"] for ff in float_features}

    n_classes = len(model.classes_)
    scale, bias = raw["scale_and_bias"]
    bias = list(bias) if isinstance(bias, list) else [float(bias)] * n_classes

    trees = []
    for tree in raw["oblivious_trees"]:
        splits = []
        for split in tree["splits"]:
            if split.get("split_type", "FloatFeature") != "FloatFeature":
                raise RuntimeError(f"Unsupported split type {split.get('split_type')}")
            splits.append([int(flat_index[split["float_feature_index"]]), float(split["border"])])
        leaves = np.asarray(tree["leaf_values"], dtype=np.float64)
        expected = (1 << len(splits)) * n_classes
        if leaves.size != expected:
            raise RuntimeError(f"Tree has {leaves.size} leaf values, expected {expected}")
        trees.append({"splits": splits, "leaves": b64_f64(leaves)})

    return {
        "schema_version": EXPORT_SCHEMA_VERSION,
        "kind": "catboost-oblivious-multiclass",
        "feature_order": CROP_FEATURES_WEB,
        "scaler": {"mean": [float(v) for v in scaler.mean_], "scale": [float(v) for v in scaler.scale_]},
        "classes": [str(c) for c in label_encoder.classes_],
        "scale": float(scale),
        "bias": [float(b) for b in bias],
        "trees": trees,
    }


def catboost_reference_predict_proba(compact: dict, X_raw: np.ndarray) -> np.ndarray:
    """Pure-numpy applier of the compact format. The TypeScript port mirrors this."""
    mean = np.asarray(compact["scaler"]["mean"], dtype=np.float64)
    scale = np.asarray(compact["scaler"]["scale"], dtype=np.float64)
    X = ((np.asarray(X_raw, dtype=np.float64) - mean) / scale).astype(np.float32)

    n_classes = len(compact["classes"])
    raw = np.zeros((X.shape[0], n_classes), dtype=np.float64)
    for tree in compact["trees"]:
        idx = np.zeros(X.shape[0], dtype=np.int64)
        for depth, (feature, border) in enumerate(tree["splits"]):
            idx |= (X[:, feature] > np.float32(border)).astype(np.int64) << depth
        leaves = np.frombuffer(base64.b64decode(tree["leaves"]), dtype="<f8").reshape(-1, n_classes)
        raw += leaves[idx]
    raw = raw * compact["scale"] + np.asarray(compact["bias"], dtype=np.float64)
    return softmax(raw)


# --------------------------------------------------------------------------
# XGBoost pipeline: compact format + reference applier
# --------------------------------------------------------------------------


def _logit(p: float) -> float:
    return float(np.log(p / (1.0 - p)))


def xgboost_pipeline_to_compact(pipeline) -> dict:
    """Convert the irrigation Pipeline (ColumnTransformer + XGBClassifier)."""
    prep = pipeline.named_steps["prep"]
    xgb_model = pipeline.named_steps["xgb"]

    scaler = prep.named_transformers_["num"]
    encoder = prep.named_transformers_["cat"]
    if list(prep.transformers_[0][2]) != IRR_NUM or list(prep.transformers_[1][2]) != IRR_CAT:
        raise RuntimeError("ColumnTransformer column order differs from the thesis pipeline.")

    vocab = {web: [str(v) for v in cats] for web, cats in zip(IRR_CAT_WEB, encoder.categories_)}

    with tempfile.TemporaryDirectory() as tmp:
        raw_path = os.path.join(tmp, "xgb.json")
        xgb_model.get_booster().save_model(raw_path)
        with open(raw_path, encoding="utf-8") as f:
            raw = json.load(f)

    learner = raw["learner"]
    objective = learner["objective"]["name"]
    if objective != "binary:logistic":
        raise RuntimeError(f"Unsupported objective {objective}")
    base_score = float(learner["learner_model_param"]["base_score"])

    trees = []
    for tree in learner["gradient_booster"]["model"]["trees"]:
        trees.append(
            {
                "feature": [int(v) for v in tree["split_indices"]],
                "threshold": [float(v) for v in tree["split_conditions"]],
                "left": [int(v) for v in tree["left_children"]],
                "right": [int(v) for v in tree["right_children"]],
                "default_left": [int(v) for v in tree["default_left"]],
            }
        )

    return {
        "schema_version": EXPORT_SCHEMA_VERSION,
        "kind": "xgboost-binary-logistic",
        # Trained on a sparse matrix: absent one-hot entries and exact zeros are
        # missing values and follow `default_left`. The applier must honour this.
        "sparse_zeros_are_missing": True,
        "numeric_order": IRR_NUM_WEB,
        "categorical_order": IRR_CAT_WEB,
        "scaler": {"mean": [float(v) for v in scaler.mean_], "scale": [float(v) for v in scaler.scale_]},
        "vocabulary": vocab,
        # Stored as a probability by XGBoost >= 2; the applier adds logit(base_score).
        "base_score": base_score,
        "trees": trees,
    }


def xgboost_reference_encode(compact: dict, frame: pd.DataFrame) -> np.ndarray:
    """
    Replicates ColumnTransformer output: scaled numerics, then one-hot blocks.

    The thesis pipeline's ColumnTransformer emits a *sparse* matrix, so XGBoost
    was trained seeing every one-hot zero (and any exactly-zero scaled value) as
    a missing value routed by `default_left`. The applier must do the same, so
    zeros are encoded as NaN here.
    """
    mean = np.asarray(compact["scaler"]["mean"], dtype=np.float64)
    scale = np.asarray(compact["scaler"]["scale"], dtype=np.float64)
    num = (frame[IRR_NUM].to_numpy(dtype=np.float64) - mean) / scale
    num = np.where(num == 0.0, np.nan, num)

    blocks = [num]
    for col, web in zip(IRR_CAT, IRR_CAT_WEB):
        cats = compact["vocabulary"][web]
        onehot = np.full((len(frame), len(cats)), np.nan, dtype=np.float64)
        index = {c: i for i, c in enumerate(cats)}
        for row, value in enumerate(frame[col].astype(str)):
            if value in index:
                onehot[row, index[value]] = 1.0
        blocks.append(onehot)
    return np.hstack(blocks).astype(np.float32)


def xgboost_reference_predict_proba(compact: dict, frame: pd.DataFrame) -> np.ndarray:
    X = xgboost_reference_encode(compact, frame)
    margin = np.full(X.shape[0], _logit(compact["base_score"]), dtype=np.float64)
    for tree in compact["trees"]:
        feature = tree["feature"]
        threshold = tree["threshold"]
        left = tree["left"]
        right = tree["right"]
        default_left = tree["default_left"]
        for row in range(X.shape[0]):
            node = 0
            while left[node] != -1:
                value = X[row, feature[node]]
                if np.isnan(value):
                    node = left[node] if default_left[node] else right[node]
                else:
                    node = left[node] if value < np.float32(threshold[node]) else right[node]
            margin[row] += threshold[node]
    return sigmoid(margin)


# --------------------------------------------------------------------------
# manifests
# --------------------------------------------------------------------------


def make_manifest(
    *,
    model_name: str,
    task: str,
    model_version: str,
    trained_at: str,
    git_revision: str,
    dataset_name: str,
    dataset_csv: Path,
    feature_order: list[str],
    classes: int,
    metrics: dict,
    artefacts: dict[str, Path],
    root: Path,
    extra: dict | None = None,
) -> dict:
    manifest = {
        "schema_version": "1.0.0",
        "model_name": model_name,
        "task": task,
        "model_version": model_version,
        "status": "production",
        "trained_at": trained_at,
        "git_revision": git_revision,
        "dataset_versions": {dataset_name: f"sha256:{sha256_file(dataset_csv)}"},
        "feature_order": feature_order,
        "classes": classes,
        "metrics": metrics,
        "artifacts": {
            name: {"path": str(path.relative_to(root)).replace(os.sep, "/"), "sha256": sha256_file(path)}
            for name, path in artefacts.items()
        },
        "release_gate": None,
    }
    if extra:
        manifest.update(extra)
    return manifest


# --------------------------------------------------------------------------
# exports
# --------------------------------------------------------------------------


def export_crop_model(
    *,
    model,
    scaler,
    label_encoder,
    crop_df: pd.DataFrame,
    dataset_csv: Path,
    out_dir: Path,
    root: Path,
    git_revision: str,
    trained_at: str,
    seed: int = 42,
) -> dict:
    from sklearn.metrics import accuracy_score, f1_score
    from sklearn.model_selection import train_test_split

    out_dir.mkdir(parents=True, exist_ok=True)

    X = crop_df[CROP_FEATURES].to_numpy(dtype=np.float64)
    y = label_encoder.transform(crop_df["label"].to_numpy())

    # The same partition the thesis evaluated on.
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.20, stratify=y, random_state=seed)
    y_pred = model.predict(scaler.transform(X_test)).ravel().astype(int)
    accuracy = float(accuracy_score(y_test, y_pred))
    macro_f1 = float(f1_score(y_test, y_pred, average="macro"))
    print(f"CatBoost held-out accuracy {accuracy:.6f}  macro F1 {macro_f1:.6f}")

    compact = catboost_to_compact(model, scaler, label_encoder)

    # Reference applier must reproduce the library on every row before export.
    lib_proba = model.predict_proba(scaler.transform(X))
    ref_proba = catboost_reference_predict_proba(compact, X)
    max_abs = float(np.max(np.abs(lib_proba - ref_proba)))
    label_agreement = float(np.mean(lib_proba.argmax(1) == ref_proba.argmax(1)))
    print(f"Reference applier: label agreement {label_agreement:.6f}, max |Δp| {max_abs:.2e}")
    if label_agreement < 1.0 or max_abs > 1e-5:
        raise RuntimeError("Compact CatBoost format does not reproduce the library; export aborted.")

    model_path = out_dir / "crop-catboost.model.json"
    cbm_path = out_dir / "crop-catboost.cbm"
    golden_path = out_dir / "crop-golden.json"

    write_json(model_path, compact)
    model.save_model(str(cbm_path), format="cbm")
    write_json(
        golden_path,
        {
            "schema_version": EXPORT_SCHEMA_VERSION,
            "feature_order": CROP_FEATURES_WEB,
            "classes": compact["classes"],
            "rows": [
                {
                    "input": [float(v) for v in X[i]],
                    "label": str(crop_df["label"].iloc[i]),
                    "predicted": compact["classes"][int(lib_proba[i].argmax())],
                    "proba": [round(float(p), 8) for p in lib_proba[i]],
                }
                for i in range(len(X))
            ],
        },
    )

    manifest = make_manifest(
        model_name="crop-recommendation-catboost",
        task="crop_recommendation",
        model_version="1.0.0",
        trained_at=trained_at,
        git_revision=git_revision,
        dataset_name="crop_recommendation",
        dataset_csv=dataset_csv,
        feature_order=CROP_FEATURES,
        classes=len(compact["classes"]),
        metrics={"held_out_accuracy": round(accuracy, 6), "macro_f1": round(macro_f1, 6)},
        artefacts={"model": model_path, "native": cbm_path, "golden": golden_path},
        root=root,
        extra={
            "serving": {"format": "catboost-oblivious-multiclass", "score_kind": "uncalibrated_model_score"},
            "notes": "Scaler and label encoder are embedded in the model JSON.",
        },
    )
    write_json(out_dir / "crop-manifest.json", manifest)
    return manifest


def export_irrigation_model(
    *,
    pipeline,
    smart_df: pd.DataFrame,
    dataset_csv: Path,
    out_dir: Path,
    root: Path,
    git_revision: str,
    trained_at: str,
    seed: int = 42,
) -> dict:
    from sklearn.metrics import accuracy_score, f1_score, matthews_corrcoef, roc_auc_score
    from sklearn.model_selection import train_test_split

    out_dir.mkdir(parents=True, exist_ok=True)

    frame = smart_df[IRR_CAT + IRR_NUM].copy()
    y = (smart_df["result"] == 1).astype(int).to_numpy()
    label2_rows = int((smart_df["result"] == 2).sum())

    _, X_test, _, y_test = train_test_split(frame, y, test_size=0.20, stratify=y, random_state=seed)
    y_pred = pipeline.predict(X_test)
    proba_test = pipeline.predict_proba(X_test)[:, 1]
    metrics = {
        "held_out_accuracy": round(float(accuracy_score(y_test, y_pred)), 6),
        "macro_f1": round(float(f1_score(y_test, y_pred, average="macro")), 6),
        "mcc": round(float(matthews_corrcoef(y_test, y_pred)), 6),
        "roc_auc": round(float(roc_auc_score(y_test, proba_test)), 6),
    }
    print("Irrigation held-out:", metrics)

    compact = xgboost_pipeline_to_compact(pipeline)

    lib_proba = pipeline.predict_proba(frame)[:, 1]
    ref_proba = xgboost_reference_predict_proba(compact, frame)
    max_abs = float(np.max(np.abs(lib_proba - ref_proba)))
    label_agreement = float(np.mean((lib_proba >= 0.5) == (ref_proba >= 0.5)))
    print(f"Reference applier: label agreement {label_agreement:.6f}, max |Δp| {max_abs:.2e}")
    if label_agreement < 1.0 or max_abs > 1e-5:
        raise RuntimeError("Compact XGBoost format does not reproduce the library; export aborted.")

    model_path = out_dir / "irrigation-xgboost.model.json"
    golden_path = out_dir / "irrigation-golden.json"
    write_json(model_path, compact)
    write_json(
        golden_path,
        {
            "schema_version": EXPORT_SCHEMA_VERSION,
            "categorical_order": IRR_CAT_WEB,
            "numeric_order": IRR_NUM_WEB,
            "rows": [
                {
                    "categorical": [str(frame[c].iloc[i]) for c in IRR_CAT],
                    "numeric": [float(frame[c].iloc[i]) for c in IRR_NUM],
                    "label": int(y[i]),
                    "source_result": int(smart_df["result"].iloc[i]),
                    "proba_irrigate": round(float(lib_proba[i]), 8),
                }
                for i in range(len(frame))
            ],
        },
    )

    manifest = make_manifest(
        model_name="irrigation-decision-xgboost",
        task="irrigation_decision",
        model_version="1.0.0",
        trained_at=trained_at,
        git_revision=git_revision,
        dataset_name="smart_agriculture",
        dataset_csv=dataset_csv,
        feature_order=IRR_CAT + IRR_NUM,
        classes=2,
        metrics=metrics,
        artefacts={"model": model_path, "golden": golden_path},
        root=root,
        extra={
            "serving": {"format": "xgboost-binary-logistic", "score_kind": "uncalibrated_model_score"},
            "label_mapping": IRRIGATION_LABEL_MAPPING,
            "label_2_rows_mapped_to_0": label2_rows,
            "vocabulary": compact["vocabulary"],
        },
    )
    write_json(out_dir / "irrigation-manifest.json", manifest)
    return manifest


def load_smart_agriculture(csv_path: Path) -> pd.DataFrame:
    """Loads the Smart Agriculture CSV with the notebook's column normalisation."""
    frame = pd.read_csv(csv_path)
    frame.columns = [c.strip().lower().replace(" ", "_") for c in frame.columns]
    return frame


def train_irrigation_pipeline(smart_df: pd.DataFrame, seed: int = 42):
    """The thesis pipeline, verbatim from the notebook (cell 117)."""
    import xgboost as xgb
    from sklearn.compose import ColumnTransformer
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler

    X = smart_df[IRR_CAT + IRR_NUM].copy()
    y = (smart_df["result"] == 1).astype(int).to_numpy()
    X_train, _, y_train, _ = train_test_split(X, y, test_size=0.20, stratify=y, random_state=seed)

    preprocess = ColumnTransformer(
        [("num", StandardScaler(), IRR_NUM), ("cat", OneHotEncoder(handle_unknown="ignore"), IRR_CAT)]
    )
    pipeline = Pipeline(
        [
            ("prep", preprocess),
            (
                "xgb",
                xgb.XGBClassifier(
                    n_estimators=400,
                    max_depth=6,
                    learning_rate=0.1,
                    tree_method="hist",
                    random_state=seed,
                    n_jobs=-1,
                    eval_metric="logloss",
                    verbosity=0,
                ),
            ),
        ]
    )
    pipeline.fit(X_train, y_train)
    return pipeline

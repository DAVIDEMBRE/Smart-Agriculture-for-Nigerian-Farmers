/**
 * Canonical research tables.
 *
 * Every number here is transcribed from the evaluation outputs of the training
 * run that produced the served artefacts (`all_17_models_comparison.csv` and
 * the notebook's SHAP dashboard), never read off an exported chart image, so
 * the web charts and the dissertation cannot drift apart. Nothing in this file
 * is computed at runtime.
 */

export type ModelFamily = "classical" | "tuned" | "ensemble" | "deep";

export type LeaderboardRow = {
  model: string;
  family: ModelFamily;
  /** Held-out accuracy on the 440-sample test partition. */
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  mcc: number;
  rocAuc: number;
  /** Training time in seconds. */
  fitSeconds: number;
  /** Inference latency in milliseconds per sample. */
  inferenceMsPerSample: number;
};

export const familyLabels: Record<ModelFamily, string> = {
  classical: "Classical",
  tuned: "Tuned",
  ensemble: "Ensemble",
  deep: "Deep learning",
};

/**
 * All eighteen evaluated configurations, ordered by held-out accuracy then
 * inference cost. Transcribed from `all_17_models_comparison.csv` in the Colab
 * bundle: the run that produced the served CatBoost artefact.
 */
export const leaderboard: LeaderboardRow[] = [
  { model: "CatBoost", family: "classical", accuracy: 0.997727, macroPrecision: 0.997835, macroRecall: 0.997727, macroF1: 0.997726, mcc: 0.997624, rocAuc: 1.0, fitSeconds: 24.034, inferenceMsPerSample: 0.0125 },
  { model: "Soft Voting Ensemble", family: "ensemble", accuracy: 0.997727, macroPrecision: 0.997835, macroRecall: 0.997727, macroF1: 0.997726, mcc: 0.997624, rocAuc: 1.0, fitSeconds: 35.308, inferenceMsPerSample: 0.4806 },
  { model: "Stacking Ensemble", family: "ensemble", accuracy: 0.997727, macroPrecision: 0.997835, macroRecall: 0.997727, macroF1: 0.997726, mcc: 0.997624, rocAuc: 1.0, fitSeconds: 173.305, inferenceMsPerSample: 0.5643 },
  { model: "Gaussian Naive Bayes", family: "classical", accuracy: 0.995455, macroPrecision: 0.995868, macroRecall: 0.995455, macroF1: 0.995443, mcc: 0.99526, rocAuc: 0.999968, fitSeconds: 0.004, inferenceMsPerSample: 0.0044 },
  { model: "Extra Trees", family: "classical", accuracy: 0.995455, macroPrecision: 0.995671, macroRecall: 0.995455, macroF1: 0.995452, mcc: 0.995249, rocAuc: 0.999984, fitSeconds: 0.866, inferenceMsPerSample: 0.2646 },
  { model: "Random Forest", family: "classical", accuracy: 0.995455, macroPrecision: 0.995671, macroRecall: 0.995455, macroF1: 0.995452, mcc: 0.995249, rocAuc: 1.0, fitSeconds: 1.515, inferenceMsPerSample: 0.2884 },
  { model: "MLP", family: "deep", accuracy: 0.995455, macroPrecision: 0.995868, macroRecall: 0.995455, macroF1: 0.995443, mcc: 0.99526, rocAuc: 0.999924, fitSeconds: 52.046, inferenceMsPerSample: 1.4748 },
  { model: "XGBoost (default)", family: "classical", accuracy: 0.993182, macroPrecision: 0.993506, macroRecall: 0.993182, macroF1: 0.993116, mcc: 0.992879, rocAuc: 0.999924, fitSeconds: 1.334, inferenceMsPerSample: 0.0184 },
  { model: "XGBoost (tuned, Optuna)", family: "tuned", accuracy: 0.993182, macroPrecision: 0.993703, macroRecall: 0.993182, macroF1: 0.99323, mcc: 0.992879, rocAuc: 1.0, fitSeconds: 4.253, inferenceMsPerSample: 0.0909 },
  { model: "Gradient Boosting", family: "classical", accuracy: 0.988636, macroPrecision: 0.989742, macroRecall: 0.988636, macroF1: 0.988723, mcc: 0.988143, rocAuc: 0.999973, fitSeconds: 13.476, inferenceMsPerSample: 0.0562 },
  { model: "LightGBM", family: "classical", accuracy: 0.988636, macroPrecision: 0.989069, macroRecall: 0.988636, macroF1: 0.988569, mcc: 0.988122, rocAuc: 0.999973, fitSeconds: 0.993, inferenceMsPerSample: 0.0865 },
  { model: "1D CNN", family: "deep", accuracy: 0.986364, macroPrecision: 0.988292, macroRecall: 0.986364, macroF1: 0.98646, mcc: 0.985805, rocAuc: 0.999995, fitSeconds: 58.436, inferenceMsPerSample: 1.6604 },
  { model: "SVM (RBF)", family: "classical", accuracy: 0.984091, macroPrecision: 0.98561, macroRecall: 0.984091, macroF1: 0.984038, mcc: 0.983413, rocAuc: 1.0, fitSeconds: 0.358, inferenceMsPerSample: 0.1091 },
  { model: "Decision Tree", family: "classical", accuracy: 0.979545, macroPrecision: 0.980598, macroRecall: 0.979545, macroF1: 0.979423, mcc: 0.97863, rocAuc: 0.989286, fitSeconds: 0.014, inferenceMsPerSample: 0.0007 },
  { model: "K-Nearest Neighbours", family: "classical", accuracy: 0.979545, macroPrecision: 0.980356, macroRecall: 0.979545, macroF1: 0.979283, mcc: 0.978635, rocAuc: 0.998723, fitSeconds: 0.004, inferenceMsPerSample: 0.0338 },
  { model: "Logistic Regression", family: "classical", accuracy: 0.972727, macroPrecision: 0.974022, macroRecall: 0.972727, macroF1: 0.972464, mcc: 0.971523, rocAuc: 0.999811, fitSeconds: 1.529, inferenceMsPerSample: 0.0013 },
  { model: "Linear Discriminant Analysis", family: "classical", accuracy: 0.968182, macroPrecision: 0.970764, macroRecall: 0.968182, macroF1: 0.968224, mcc: 0.966797, rocAuc: 0.999816, fitSeconds: 0.016, inferenceMsPerSample: 0.0011 },
  { model: "Attention MLP", family: "deep", accuracy: 0.620455, macroPrecision: 0.619052, macroRecall: 0.620455, macroF1: 0.598849, mcc: 0.604261, rocAuc: 0.967765, fitSeconds: 59.827, inferenceMsPerSample: 2.7911 },
];

/** The five configurations shown on the homepage summary chart. */
export const leaderboardHighlights = leaderboard.slice(0, 5);

export type FeatureImportanceRow = {
  /** Feature name as used by the prediction form. */
  label: string;
  /** Column name used by the model. */
  modelName: string;
  /** Mean absolute SHAP value across all test samples and all 22 classes. */
  meanAbsShap: number;
};

/**
 * Global SHAP importance, mean |SHAP| across 440 test samples and 22 classes.
 *
 * Computed on the tuned XGBoost, which is the tree model the notebook explains;
 * these are not CatBoost attributions. Per-prediction explanations stay disabled
 * in the API until CatBoost-specific SHAP output is verified against known
 * samples.
 */
export const featureImportance: FeatureImportanceRow[] = [
  { label: "Relative humidity", modelName: "humidity", meanAbsShap: 0.9825 },
  { label: "Rainfall", modelName: "rainfall", meanAbsShap: 0.923 },
  { label: "Phosphorus", modelName: "P", meanAbsShap: 0.7102 },
  { label: "Potassium", modelName: "K", meanAbsShap: 0.6824 },
  { label: "Nitrogen", modelName: "N", meanAbsShap: 0.5131 },
  { label: "Temperature", modelName: "temperature", meanAbsShap: 0.3247 },
  { label: "Soil pH", modelName: "ph", meanAbsShap: 0.211 },
];

export const shapProvenance = {
  explainedModel: "XGBoost (tuned, Optuna)",
  samples: 440,
  classes: 22,
  note: "Mean absolute SHAP value across every test sample and every crop class, computed with a tree explainer on the tuned XGBoost.",
};

export type DatasetRow = {
  name: string;
  role: "training" | "context" | "withheld";
  records: string;
  detail: string;
};

export const datasets: DatasetRow[] = [
  {
    name: "Crop Recommendation Dataset",
    role: "training",
    records: "2,200 records",
    detail: "Seven features and 22 balanced crop classes. The only dataset used to train the public crop recommender.",
  },
  {
    name: "Nigeria Digital Soil Map",
    role: "context",
    records: "658 polygons, 58 mapping units",
    detail: "Soil texture, pH, drainage and dominant crops across Nigeria's three ecological zones. Geographic context, not training data.",
  },
  {
    name: "HarvestStat Africa",
    role: "context",
    records: "30,530 rows",
    detail: "Harmonised subnational crop production statistics used to check agronomic plausibility.",
  },
  {
    name: "CropHarvest Nigeria",
    role: "context",
    records: "693 samples, 12 timesteps, 18 bands",
    detail: "Sentinel-1, Sentinel-2, ERA5 and SRTM time series used for remote-sensing relevance checks.",
  },
  {
    name: "Smart Agriculture Dataset",
    role: "training",
    records: "16,411 records",
    detail: "Trains the binary irrigation decision model: five crops, seven soil types, eight growth stages, moisture index, temperature and humidity.",
  },
  {
    name: "IoT Agriculture 2024",
    role: "withheld",
    records: "16,105 records",
    detail: "Actuator telemetry with 0-255 scaled NPK. Used for schema harmonisation study only.",
  },
  {
    name: "Advanced IoT Agriculture 2024",
    role: "withheld",
    records: "30,000 records",
    detail: "Plant growth measurements retained for the yield-insight research track.",
  },
];

/** The eight metrics the evaluation harness reports for every configuration. */
export const evaluationMetrics = [
  "Accuracy",
  "Macro precision",
  "Macro recall",
  "Macro F1",
  "Matthews correlation",
  "ROC-AUC",
  "Training time",
  "Inference latency",
];

export const methodChecks = [
  {
    title: "Leakage control",
    detail: "The train-test split occurs before learned scaling. The scaler is fitted on the 1,760-row training partition only.",
  },
  {
    title: "Stability checks",
    detail: "Five-fold cross-validation, McNemar paired tests, a Friedman rank test and four ablation studies.",
  },
  {
    title: "Explainability",
    detail: "SHAP tree attribution over all 440 test samples and 22 classes, reported as a global ranking rather than a per-user explanation.",
  },
];

/**
 * How each release condition for the irrigation model was resolved. The model
 * is served, and each of these is disclosed on the research page.
 */
export const irrigationReleaseConditions = [
  {
    condition: "What label 2 in the source data means",
    resolution:
      "The dissertation (§4.1.12) evaluates a binary model and never mentions label 2. The served model matches the thesis: the 1,122 rows (6.8%) with label 2 are mapped to \"do not irrigate\", and the manifest and this page disclose it.",
  },
  {
    condition: "Soil moisture bounded to the observed range",
    resolution: "The API accepts a moisture index of 1-100 only; the dataset contains nothing outside it.",
  },
  {
    condition: "Crop, soil and growth-stage categories match the training schema",
    resolution: "The API accepts exactly the five crops, seven soils and eight stages the model was trained on, as fixed choices rather than free text.",
  },
  {
    condition: "Re-evaluated on valid examples",
    resolution: "Retrained with the thesis recipe; 3,282 of 3,283 held-out cases correct (99.97%), and a reference applier reproduces every one of the 16,411 rows before export.",
  },
  {
    condition: "No silent fallback for unknown categories",
    resolution: "An unknown category is rejected with a validation error before it reaches the model. The training pipeline's own encoder would have accepted it silently.",
  },
];

/**
 * Measured on the artefact this deployment serves, from the 2026-09-22 training
 * run. The dissertation reports 3,282 of 3,283 for its own run; this run makes
 * one more error, which is within the variation expected from a different
 * library build. The served number is the one shown.
 */
export const irrigationBenchmark = {
  accuracy: 0.999391,
  testRows: 3283,
  correct: 3281,
  thesisCorrect: 3282,
  note: "3,281 of 3,283 held-out cases on the served artefact. Measured on curated data with binarised labels; it is not evidence of field irrigation safety.",
  crops: ["Carrot", "Chilli", "Potato", "Tomato", "Wheat"],
  overlapWithRecommender: 0,
};

/** Figures exported by the training run, shown as expandable research figures. */
export const modelFigures = [
  {
    id: "catboost-confusion",
    src: "/research/catboost_confusion_matrix.png",
    width: 2400,
    height: 2000,
    alt: "Confusion matrix for the CatBoost crop recommender across all 22 crop classes, with almost all mass on the diagonal",
    caption: "CatBoost confusion matrix on the 440-sample held-out partition, 20 samples per class.",
    source: "Training run of 2026-09-22; the artefact this site serves.",
    method: "Predictions on the stratified 20% test partition, counted against the true label for each of the 22 classes.",
  },
  {
    id: "irrigation-cm-roc",
    src: "/research/irrigation_cm_and_roc.png",
    width: 2600,
    height: 1100,
    alt: "Confusion matrix and ROC curve for the binary irrigation classifier, showing near-perfect separation",
    caption: "Irrigation classifier: confusion matrix and ROC curve on the 3,283-sample held-out partition.",
    source: "Training run of 2026-09-22; the artefact this site serves.",
    method: "Binary labels with result 2 mapped to 'do not irrigate'; ROC computed from the predicted probability of irrigating.",
  },
] as const;

export const soilFigure = {
  src: "/research/nigeria-soil-ph-map.png",
  alt: "Choropleth map of Nigeria shaded by soil pH midpoint class, with the wetter southern zones showing the most acidic soils",
  caption: "Soil pH midpoint classes across Nigeria's 58 soil mapping units.",
  source: "Nigeria Digital Soil Map (Mendeley Data), 658 polygons across three ecological zones.",
  method: "The shapefile was loaded with GeoPandas and each mapping unit shaded by the midpoint of its recorded pH band. No model output is drawn on this map.",
};

export const studyFacts = {
  configurations: 18,
  cropClasses: 22,
  features: 7,
  trainingRows: 1760,
  testRows: 440,
  datasets: 7,
  bestAccuracy: 0.997727,
};

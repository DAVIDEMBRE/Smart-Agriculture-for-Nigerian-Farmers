import { describe, expect, it } from "vitest";
import {
  datasets,
  evaluationMetrics,
  featureImportance,
  irrigationBenchmark,
  irrigationReleaseConditions,
  leaderboard,
  leaderboardHighlights,
  studyFacts,
} from "@/lib/research-data";
import { featureKeys } from "@/lib/contracts";

describe("leaderboard", () => {
  it("holds every evaluated configuration the study reports", () => {
    expect(leaderboard).toHaveLength(studyFacts.configurations);
    expect(new Set(leaderboard.map((row) => row.model)).size).toBe(leaderboard.length);
  });

  it("matches the family breakdown described on the research page", () => {
    const counts = leaderboard.reduce<Record<string, number>>((totals, row) => {
      totals[row.family] = (totals[row.family] ?? 0) + 1;
      return totals;
    }, {});
    expect(counts).toEqual({ classical: 12, tuned: 1, ensemble: 2, deep: 3 });
  });

  it("is ordered by descending accuracy so the chart and table agree", () => {
    for (let index = 1; index < leaderboard.length; index += 1) {
      expect(leaderboard[index - 1].accuracy).toBeGreaterThanOrEqual(leaderboard[index].accuracy);
    }
  });

  it("keeps every rate metric inside 0-1", () => {
    for (const row of leaderboard) {
      for (const value of [row.accuracy, row.macroPrecision, row.macroRecall, row.macroF1, row.mcc, row.rocAuc]) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(row.fitSeconds).toBeGreaterThanOrEqual(0);
      expect(row.inferenceMsPerSample).toBeGreaterThan(0);
    }
  });

  it("names CatBoost as the best configuration at the accuracy the site quotes", () => {
    expect(leaderboard[0].model).toBe("CatBoost");
    expect(leaderboard[0].accuracy).toBe(studyFacts.bestAccuracy);
  });

  it("shows CatBoost reaching the top score with the cheapest inference of the three", () => {
    const joint = leaderboard.filter((row) => row.accuracy === studyFacts.bestAccuracy);
    expect(joint).toHaveLength(3);
    const cheapest = [...joint].sort((a, b) => a.inferenceMsPerSample - b.inferenceMsPerSample)[0];
    expect(cheapest.model).toBe("CatBoost");
  });

  it("highlights the first five rows on the homepage", () => {
    expect(leaderboardHighlights).toEqual(leaderboard.slice(0, 5));
  });

  it("reports the eight metrics the evaluation harness produces", () => {
    expect(evaluationMetrics).toHaveLength(8);
  });
});

describe("feature importance", () => {
  it("covers exactly the seven model inputs", () => {
    expect(featureImportance).toHaveLength(featureKeys.length);
    expect(new Set(featureImportance.map((row) => row.modelName)).size).toBe(featureKeys.length);
  });

  it("is ordered by descending mean absolute SHAP value", () => {
    for (let index = 1; index < featureImportance.length; index += 1) {
      expect(featureImportance[index - 1].meanAbsShap).toBeGreaterThan(featureImportance[index].meanAbsShap);
    }
  });

  it("keeps every attribution positive, since it is a mean absolute value", () => {
    expect(featureImportance.every((row) => row.meanAbsShap > 0)).toBe(true);
  });
});

describe("data provenance", () => {
  it("lists the seven datasets the study used", () => {
    expect(datasets).toHaveLength(studyFacts.datasets);
  });

  it("trains each served model on exactly one dataset", () => {
    const training = datasets.filter((item) => item.role === "training").map((item) => item.name);
    expect(training).toEqual(["Crop Recommendation Dataset", "Smart Agriculture Dataset"]);
  });

  it("keeps the IoT datasets out of the served models", () => {
    const withheld = datasets.filter((item) => item.role === "withheld").map((item) => item.name);
    expect(withheld).toEqual(["IoT Agriculture 2024", "Advanced IoT Agriculture 2024"]);
  });
});

describe("irrigation release conditions", () => {
  it("records how all five conditions were resolved", () => {
    expect(irrigationReleaseConditions).toHaveLength(5);
    expect(irrigationReleaseConditions.every((item) => item.resolution.length > 40)).toBe(true);
  });

  it("discloses the label-2 mapping, the moisture bound and the fallback removal", () => {
    const text = irrigationReleaseConditions.map((item) => `${item.condition} ${item.resolution}`).join(" ");
    expect(text).toMatch(/label 2/);
    expect(text).toMatch(/1,122/);
    expect(text).toMatch(/1-100/);
    expect(text).toMatch(/fallback/i);
  });

  it("states that the irrigation crops do not overlap the recommender", () => {
    expect(irrigationBenchmark.crops).toHaveLength(5);
    expect(irrigationBenchmark.overlapWithRecommender).toBe(0);
    expect(irrigationBenchmark.accuracy).toBeCloseTo(irrigationBenchmark.correct / irrigationBenchmark.testRows, 6);
    expect(irrigationBenchmark.correct).toBeLessThanOrEqual(irrigationBenchmark.thesisCorrect);
  });
});

describe("study facts", () => {
  it("matches the split the notebook reports", () => {
    expect(studyFacts.trainingRows + studyFacts.testRows).toBe(2200);
    expect(studyFacts.features).toBe(featureKeys.length);
    expect(studyFacts.cropClasses).toBe(22);
  });
});

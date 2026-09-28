import { describe, expect, it } from "vitest";
import { cropGuidance, findCropGuidance } from "./crops";
import { growthStages } from "./types";
import { irrigationCrops } from "@/lib/contracts";
import { releasedLocales } from "@/lib/content";

/** The 22 classes the crop recommender can return, from the exported model. */
const recommenderCrops = [
  "apple", "banana", "blackgram", "chickpea", "coconut", "coffee", "cotton", "grapes", "jute", "kidneybeans",
  "lentil", "maize", "mango", "mothbeans", "mungbean", "muskmelon", "orange", "papaya", "pigeonpeas",
  "pomegranate", "rice", "watermelon",
];

describe("watering guidance knowledge base", () => {
  it("covers every recommender crop and every irrigation-model crop", () => {
    for (const crop of recommenderCrops) expect(findCropGuidance(crop), crop).toBeDefined();
    for (const crop of irrigationCrops) expect(findCropGuidance(crop), crop).toBeDefined();
    expect(cropGuidance).toHaveLength(recommenderCrops.length + irrigationCrops.length);
  });

  it("marks exactly the five irrigation-model crops, and none of them is a recommender crop", () => {
    const flagged = cropGuidance.filter((c) => c.irrigationModelCrop).map((c) => c.id).sort();
    expect(flagged).toEqual([...irrigationCrops].map((c) => c.toLowerCase()).sort());
    expect(flagged.some((id) => recommenderCrops.includes(id))).toBe(false);
  });

  it("has unique ids that resolve case-insensitively", () => {
    expect(new Set(cropGuidance.map((c) => c.id)).size).toBe(cropGuidance.length);
    expect(findCropGuidance("Tomato")?.id).toBe("tomato");
    expect(findCropGuidance("  RICE ")?.id).toBe("rice");
  });

  it.each(cropGuidance)("$id has complete, plausible data", (crop) => {
    for (const locale of releasedLocales) {
      expect(crop.name[locale].length).toBeGreaterThan(0);
      for (const key of ["critical", "afterRain", "watchFor", "practice"] as const) {
        expect(crop.notes[locale][key].length, `${crop.id}.${locale}.${key}`).toBeGreaterThan(30);
      }
    }
    // Pidgin must be genuinely translated.
    expect(crop.notes.pcm.critical).not.toBe(crop.notes.en.critical);

    for (const value of Object.values(crop.kc)) {
      expect(value).toBeGreaterThan(0.2);
      expect(value).toBeLessThanOrEqual(1.25);
    }
    // Annual crops build canopy, so Kc rises to mid-season. Evergreen trees
    // (citrus in FAO-56) can legitimately run flat or slightly lower.
    if (!["fruit_tree", "plantation"].includes(crop.category)) {
      expect(crop.kc.mid).toBeGreaterThanOrEqual(crop.kc.initial);
    }
    expect(crop.kcBasis.length).toBeGreaterThan(10);
    expect(crop.criticalStages.length).toBeGreaterThan(0);
    for (const stage of crop.criticalStages) expect(growthStages).toContain(stage);
    expect(crop.sources.length).toBeGreaterThan(0);
    for (const source of crop.sources) {
      expect(source.url).toMatch(/^https?:\/\//);
      expect(source.title.length).toBeGreaterThan(5);
    }
  });

  it("uses FAO-56 or FAO Training Manual 3 for every crop that has an entry there", () => {
    const faoListed = ["rice", "maize", "chickpea", "kidneybeans", "lentil", "mungbean", "apple", "orange", "banana", "grapes", "watermelon", "muskmelon", "coconut", "coffee", "cotton", "carrot", "chilli", "potato", "tomato", "wheat"];
    for (const id of faoListed) {
      const crop = findCropGuidance(id)!;
      expect(crop.kcBasis, id).toMatch(/FAO/);
    }
  });

  it("states the proxy openly for crops FAO does not list", () => {
    for (const id of ["blackgram", "mothbeans", "pigeonpeas", "mango", "pomegranate", "papaya", "jute"]) {
      const crop = findCropGuidance(id)!;
      expect(crop.kcBasis, id).toMatch(/no .* entry|proxy|no reliable published|used/i);
    }
  });

  it("flags rice as the only flooded crop", () => {
    expect(cropGuidance.filter((c) => c.waterNeed === "flooded").map((c) => c.id)).toEqual(["rice"]);
  });
});

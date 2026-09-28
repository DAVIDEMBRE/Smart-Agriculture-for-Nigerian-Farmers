import { describe, expect, it } from "vitest";
import {
  copy,
  isLocale,
  localeRegistry,
  nextLocale,
  releasedLocales,
  type Dictionary,
  type Locale,
} from "@/lib/content";

/** Walks a dictionary and returns every leaf path, e.g. "hero.title". */
function paths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => paths(child, prefix ? `${prefix}.${key}` : key));
}

/** Returns the value at a dotted path. */
function at(dictionary: Dictionary, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], dictionary);
}

describe("locale registry", () => {
  it("marks exactly the released locales as released", () => {
    const released = Object.values(localeRegistry)
      .filter((entry) => entry.status === "released")
      .map((entry) => entry.code);
    expect(released.sort()).toEqual([...releasedLocales].sort());
  });

  it("declares Hausa, Yoruba and Igbo as planned so they can be added without code changes", () => {
    for (const code of ["ha", "yo", "ig"] as const) {
      expect(localeRegistry[code].status).toBe("planned");
      expect(localeRegistry[code].htmlLang).toMatch(/-NG$/);
    }
  });

  it("ships no audio track in v1", () => {
    expect(Object.values(localeRegistry).every((entry) => entry.audio === false)).toBe(true);
  });

  it("cycles through the released locales", () => {
    expect(nextLocale("en")).toBe("pcm");
    expect(nextLocale("pcm")).toBe("en");
  });

  it("recognises released locale codes only", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pcm")).toBe(true);
    expect(isLocale("ha")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe("translation dictionaries", () => {
  const englishPaths = paths(copy.en).sort();

  it.each(releasedLocales)("%s covers every key with a non-empty string", (locale: Locale) => {
    expect(paths(copy[locale]).sort()).toEqual(englishPaths);
    for (const path of englishPaths) {
      const value = at(copy[locale], path);
      expect(typeof value, `${locale}.${path} should be a string`).toBe("string");
      expect((value as string).trim().length, `${locale}.${path} should not be empty`).toBeGreaterThan(0);
    }
  });

  it("actually translates the Pidgin copy rather than reusing English", () => {
    // A handful of proper nouns and units are identical by design; the bulk of
    // the copy must differ or the dictionary is not really translated.
    const differing = englishPaths.filter((path) => at(copy.en, path) !== at(copy.pcm, path));
    expect(differing.length / englishPaths.length).toBeGreaterThan(0.6);
  });

  it("keeps the explanation heading in both locales for when attributions arrive", () => {
    expect(copy.en.result.explanations.length).toBeGreaterThan(0);
    expect(copy.pcm.result.explanations).not.toBe(copy.en.result.explanations);
  });

  it("maps every API error kind to copy", () => {
    for (const locale of releasedLocales) {
      for (const key of ["invalidInput", "offline", "timeout", "unavailable", "malformed", "generic"] as const) {
        expect(copy[locale].errors[key].length).toBeGreaterThan(0);
      }
    }
  });
});

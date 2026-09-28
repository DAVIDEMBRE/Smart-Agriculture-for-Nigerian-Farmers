#!/usr/bin/env node
/**
 * Release gate: verifies every `artifacts/*-manifest.json`.
 *
 *   1. Each manifest is internally consistent (a `production` status may not
 *      sit on top of null checksums; a blocked status must state its gate; an
 *      irrigation manifest must disclose its label mapping).
 *   2. Every artefact a manifest names exists on disk and its SHA-256 matches.
 *
 * Exits non-zero on any failure, so CI blocks a promotion that is not backed by
 * verifiable artefacts.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const artifactsDir = path.join(root, "artifacts");

let failures = 0;
function fail(message) {
  console.error(`✗ ${message}`);
  failures += 1;
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

const manifestFiles = (await readdir(artifactsDir)).filter((name) => name.endsWith("-manifest.json")).sort();
if (manifestFiles.length === 0) fail("no *-manifest.json found in artifacts/");

for (const file of manifestFiles) {
  const manifest = JSON.parse(await readFile(path.join(artifactsDir, file), "utf8"));
  const label = `${file} (${manifest.task ?? "unknown task"})`;

  // --- consistency --------------------------------------------------------
  const missing = [];
  if (!manifest.model_version) missing.push("model_version");
  if (!manifest.trained_at) missing.push("trained_at");
  if (!manifest.git_revision) missing.push("git_revision");
  if (!manifest.artifacts?.model) missing.push("artifacts.model");
  for (const [name, ref] of Object.entries(manifest.artifacts ?? {})) {
    if (!ref.path) missing.push(`artifacts.${name}.path`);
    if (!ref.sha256) missing.push(`artifacts.${name}.sha256`);
  }
  for (const [dataset, version] of Object.entries(manifest.dataset_versions ?? {})) {
    if (version === "local-unversioned") missing.push(`dataset_versions.${dataset}`);
  }

  if (manifest.status === "production") {
    for (const field of missing) fail(`${label}: status is "production" but ${field} is not populated`);
    if (manifest.task === "irrigation_decision" && !manifest.label_mapping) {
      fail(`${label}: an irrigation manifest must disclose its label_mapping`);
    }
  } else if (missing.length === 0) {
    fail(`${label}: every promotion field is populated but status is still "${manifest.status}"`);
  } else if (!manifest.release_gate) {
    fail(`${label}: a blocked manifest must state its release_gate`);
  }

  // --- checksums ----------------------------------------------------------
  let verified = 0;
  for (const [name, ref] of Object.entries(manifest.artifacts ?? {})) {
    if (!ref.path) continue;
    const artefactPath = path.resolve(root, ref.path);
    if (!existsSync(artefactPath)) {
      fail(`${label}: ${name} → ${ref.path} is named in the manifest but is not on disk`);
      continue;
    }
    if (!ref.sha256) continue;
    const actual = await sha256(artefactPath);
    if (actual !== ref.sha256) {
      fail(`${label}: checksum mismatch for ${ref.path}\n    expected ${ref.sha256}\n    actual   ${actual}`);
    } else {
      verified += 1;
    }
  }

  if (manifest.status === "production") {
    console.log(`✓ ${label}: production, ${verified} artefact(s) checksummed, held-out accuracy ${manifest.metrics?.held_out_accuracy}`);
  } else {
    console.log(`✓ ${label}: consistently blocked. Outstanding: ${missing.join(", ")}`);
  }
}

if (failures) {
  console.error(`\nManifest verification failed (${failures}).`);
  process.exitCode = 1;
}

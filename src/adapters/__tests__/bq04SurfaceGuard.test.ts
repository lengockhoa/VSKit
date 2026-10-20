// Dependency contract guard for the BigQuery surface work. Runtime behavior
// is covered by the boundary, adapter, and extension tests; dependencies are
// pinned independently here without requiring Git history.
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import { resolve } from "node:path";
import {
  changedDependencySections,
  PACKAGE_DEPENDENCY_BASELINE,
  type DependencyManifest,
} from "./packageDependencyBaseline";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

describe("TASK-BQ04-003 dependency contract", () => {
  it("package dependency sections match the standalone fixture", () => {
    const current = JSON.parse(fs.readFileSync(`${REPO_ROOT}/package.json`, "utf8")) as DependencyManifest;
    expect(changedDependencySections(current)).toEqual([]);
  });

  it("detects a newly added runtime dependency", () => {
    const mutated: DependencyManifest = {
      ...PACKAGE_DEPENDENCY_BASELINE,
      dependencies: {
        ...PACKAGE_DEPENDENCY_BASELINE.dependencies,
        "new-runtime-package": "^1.0.0",
      },
    };
    expect(changedDependencySections(mutated)).toEqual(["dependencies"]);
  });

  it("detects upgraded runtime and development dependency versions", () => {
    const mutated: DependencyManifest = {
      ...PACKAGE_DEPENDENCY_BASELINE,
      dependencies: {
        ...PACKAGE_DEPENDENCY_BASELINE.dependencies,
        "@google-cloud/bigquery": "^10.0.0",
      },
      devDependencies: {
        ...PACKAGE_DEPENDENCY_BASELINE.devDependencies,
        vitest: "^2.0.0",
      },
    };
    expect(changedDependencySections(mutated)).toEqual([
      "dependencies",
      "devDependencies",
    ]);
  });
});

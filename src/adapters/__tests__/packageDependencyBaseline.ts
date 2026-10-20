export type DependencyManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  engines?: Record<string, string>;
};

/** Frozen package-dependency contract used by the manifest guard. */
export const PACKAGE_DEPENDENCY_BASELINE: Required<DependencyManifest> = {
  dependencies: {
    "@google-cloud/bigquery": "^9.0.3",
    "@types/pg": "^8.11.0",
    "ag-grid-community": "^36.1.0",
    "mysql2": "^3.10.0",
    "pg": "^8.11.5",
    tedious: "^18.6.1",
  },
  devDependencies: {
    "@types/vscode": "1.75.0",
    "@vscode/vsce": "^3.0.0",
    esbuild: "^0.24.0",
    jsdom: "^29.1.1",
    typescript: "^5.4.5",
    vitest: "^1.6.0",
  },
  peerDependencies: {},
  optionalDependencies: {},
  engines: { vscode: "^1.75.0" },
};

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "engines",
] as const;

function canonicalSection(section: Record<string, string> | undefined): string {
  return JSON.stringify(
    Object.entries(section ?? {}).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

export function changedDependencySections(
  candidate: DependencyManifest,
): string[] {
  return DEPENDENCY_SECTIONS.filter(
    (section) =>
      canonicalSection(candidate[section]) !==
      canonicalSection(PACKAGE_DEPENDENCY_BASELINE[section]),
  );
}

# VSKit Release and Package Status

## Current distribution status

GitHub releases `v1.55.6` through `v1.55.13` retain their VSIX assets. Marketplace publication is paused.

The current owner diagnostic-capture package is GitHub release `v1.55.13`: `dist/vskit-1.55.13.vsix` (2,279,284 bytes; SHA-256 `ea9dd821402ba8c8f7e5bd0a4c3f1090cf2dd58b28a0a9ffe6cfc80284eb1db7`). The release asset digest matches the local package. Its manifest confirms the Generate Commit Message SVG command icon and default-off diagnostics. VS Code icon UI verification and owner-side latency measurement remain pending; no runtime speedup is claimed. Release page: https://github.com/lengockhoa/VSKit/releases/tag/v1.55.13

Earlier ship history: `v1.55.7` pushed commit `bbab82b`; `v1.55.8` pushed commit `528b279`; `v1.55.10` pushed commit `100f3ba`; and `v1.55.11` included `vskit-1.55.11.vsix` (SHA-256 `e017f0a7a08041e815f8272a9c0b0d468388f7006f52d8a31eca434378884ca9`). The release workflow is `.github/workflows/ci.yml`; it runs verification only and does not publish a package.

## Build and install a local VSIX

From the repository root, the build script runs the checks in dependency order
(typecheck, compile, tests, package) and prints the generated artifact path:

```bash
bash scripts/build.sh
```

With the current manifest version `1.55.13`, the expected local artifact is
`dist/vskit-1.55.13.vsix`. Packaging itself does not publish it.

```bash
code --install-extension "$(pwd)/dist/vskit-1.55.13.vsix"
```

The package identity is `lengockhoa.vskit`; the package name is lowercase `vskit`. The current local `dist/vskit-1.55.13.vsix` is the owner-test package and has not been uploaded. The previous published GitHub asset is the original `v1.55.12` package described above. Marketplace listing availability remains unverified; publication is paused.

## Version policy during this conversion

For the previous conversion release, the package was version `1.55.8` because
immutable tags `v1.55.6` and `v1.55.7` already existed; neither tag was reused.
No project-specific version or release script was run for that conversion.
`npm version patch --no-git-tag-version --ignore-scripts` updated the package
version and lockfile root only; the root identity/version remain synchronized.

The `.github/workflows/ci.yml` workflow runs CI checks only. No Marketplace
publish workflow or publish npm script remains while publication is paused.

## Local install and persistence

The installer accepts a local VSIX with `bash scripts/install-vskit.sh --local <file.vsix>`. Its no-argument mode queries the latest GitHub release asset; that route has not been verified for VSKit.

VSKit uses the separate extension identity `lengockhoa.vskit`. VS Code scopes extension `globalState`, `workspaceState`, and `SecretStorage` to that identity, and this package contains no cross-identity importer or copier:

- Connection profiles and active-connection selection, AI settings, console history and drafts, chat-session state, and schema filters/pins are not read from the prior extension's stores.
- Database passwords and AI API keys in `SecretStorage` are not accessible to VSKit. Recreate connections and AI settings, then enter credentials through the VSKit forms. Do not copy secrets into plain settings or generated files.
- Existing user/workspace settings are left unchanged, but values under the prior configuration namespace are not read. Reapply non-secret values using the current `VSKit.*` settings.
- AI chat sessions support individual Markdown/JSON export, but there is no import path. An export is an archive, not a resumable session; export from the prior installation before removing it if you need a copy.
- Saved SQL files and other ordinary workspace files are not moved or deleted. Generated AI workspace files from a prior installation are not renamed or imported; run the relevant **VSKit: Use AI with …** command to create current files.

The prior extension and its VS Code storage are not removed by this package. Keep the prior installation until you have recreated the data you still need.

The development Compose stack now has distinct VSKit container/database/volume identifiers. It will use fresh volumes instead of attaching the previous stack's stores; existing Docker volumes are neither renamed nor deleted. Ports `5433`, `3307`, and `1434` are unchanged, so a previous test container still bound to one of them prevents the new stack from starting concurrently. Back up and migrate database contents manually with database tools if needed. This task did not start, stop, or modify any Docker service or volume.

The previous integration fixture names and sample credentials were changed only in Compose and test configuration; they do not migrate or alter any existing database store.

## Maintainer verification order

The supported local checks are:

```bash
npm run typecheck
npm run compile
npm test
npx @vscode/vsce package --no-dependencies -o dist/
```

Compile precedes tests because some regression tests read generated `dist`
bundles during module initialization. Inspect the resulting archive and its
identity/resources before distributing it. Do not run version bump, Git
release, or Marketplace actions as part of local package verification.

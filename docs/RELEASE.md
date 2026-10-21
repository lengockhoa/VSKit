# VSKit Release and Local Package Status

## Current distribution status

The existing GitHub `v1.55.6` release retains its published VSIX asset; that release artifact remains unchanged. The VSKit `v1.55.7` release carries `vskit-1.55.7.vsix`; the current `v1.55.8` release carries `vskit-1.55.8.vsix`. Marketplace listing availability is unverified; publication is paused.

The package command created only the local VSIX. The separate ship sequence pushed commit `bbab82b` to `main`, pushed tag `v1.55.7`, and created the GitHub release with the VSIX asset. Marketplace publishing, VS Code installation, and reload were not performed.
The v1.55.8 ship sequence pushed commit `528b279` to `main`, pushed tag `v1.55.8`, and created the GitHub release with the VSIX asset. Marketplace publishing, VS Code installation/reload, and database integration were not performed.
The release workflow is `.github/workflows/ci.yml`; it runs verification only and does not publish a package.

## Build and install a local VSIX

From the repository root, the build script runs the checks in dependency order
(typecheck, compile, tests, package) and prints the generated artifact path:

```bash
bash scripts/build.sh
```

With the current manifest version `1.55.10`, the expected artifact is
`dist/vskit-1.55.10.vsix`. Install it only when you choose to test it:

```bash
code --install-extension "$(pwd)/dist/vskit-1.55.10.vsix"
```

The package identity is `lengockhoa.vskit`; the package name is lowercase
`vskit`. The `vskit-1.55.8.vsix` artifact is attached to GitHub release
`v1.55.8`. Marketplace listing availability remains unverified; publication
is paused.

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

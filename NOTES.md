# VSKit — Project Notes

> File này ở project root, NGOÀI phạm vi UKit (UKit touch `.claude/`, `.ukit/`, `docs/`). Mọi ghi chú dài hạn nên viết ở đây để không bị UKit bump/version scripts ghi đè.

---

## Workflow trên máy này (Lenk dev vibecode)

- **Không chạy test có database thật** — máy vibecode dev; unit suite vẫn chạy được local.
- **Standalone conversion 2026-10-20:** Marketplace publishing is paused; `scripts/bump-version.mjs` and the npm `bump*` aliases have been removed.
- **Build local:** `scripts/build.sh` (ci → typecheck → compile → test → vsix) hoặc `npm run package`.
- **Khi publish hoạt động lại:** đọc `docs/RELEASE.md` trước — lockfile root name phải khớp `package.json`, CI hiện chỉ chạy check, không còn workflow/npm script publish.

---

## Lesson learned — VS Code SCM context keys (2026-09-06)

**Bug regression từ 1.52.0 → fixed in 1.53.3:**
Generate Commit Message sparkle (VSKit) bị ẩn hoàn toàn khỏi Source Control title bar.

**Root cause:**
```json
"when": "scmProvider == git && scmProviderHasChanges"
```
`scmProviderHasChanges` **không phải** VS Code SCM context key thật.

**Context keys thật của VS Code SCM:**
- `scmProvider` — id của SCM provider đang active
- `scmProviderHasRootUri` — provider có root URI không (không phải detached HEAD)
- (Không có `scmProviderHasChanges`)

**Khi VS Code gặp context key không tồn tại → evaluate thành `undefined`/`false` → cả `when` clause fail → menu item bị ẩn vĩnh viễn.**

**Fix:**
```json
"when": "scmProvider == git"
```

**Takeaway:** Khi viết `when` clause cho SCM menu, chỉ dùng các key thật:
- `scmProvider` (so sánh == với id, vd `git`)
- `scmProviderHasRootUri`
- `scmResourceGroup` (trong `scm/resourceGroup/*`)
- `scmResourceState` (trong `scm/resourceState/*`)

**Lesson cho frozen test assertions:** Test `commitGenManifest.test.ts` và `commitGenIntegration.test.ts` freeze `when` clause dưới dạng string literal. Mỗi lần fix `when`, phải update cả 2 test files (case 2 + constant).

---

## Menu locations cho SCM buttons

| Menu key | Vị trí hiển thị |
|----------|------------------|
| `scm/title` | Source Control panel header (top, cùng hàng với `...` more menu) |
| `scm/sourceControl/title` | Per-source-control-provider title (như `scm/title` nhưng riêng từng provider) |
| `scm/resourceGroup/title` | Resource group header (Changes subheader — nơi Copilot sparkle hiện) |
| `scm/resourceState/context` | Right-click trên 1 file changed |

Để sparkle hiện ngay hàng với GitHub Copilot (dễ thấy hơn), register vào `scm/resourceGroup/title` với `when: "scmProvider == git && scmResourceGroup =~ /Changes/"`.

---

## Release artifacts map

Mỗi version phát hành tạo:
1. `package.json` — bump version field
2. `CHANGELOG.md` — append entry ở đầu
3. `package-lock.json` — bump version
4. Git tag `vX.Y.Z`
5. GitHub release vX.Y.Z (attach `.vsix`)
6. Marketplace extension version

Tất cả 6 bước nên atomic — nếu fail bước nào thì rollback.

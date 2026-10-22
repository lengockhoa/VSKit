# Hướng dẫn sử dụng VSKit

> Hướng dẫn sử dụng VSKit — VS Code extension cho PostgreSQL / MySQL / MSSQL / BigQuery.

## Cài đặt

Build the local VSIX from the repository root:

```bash
bash scripts/build.sh
```

For the current package version, install with:

```bash
code --install-extension "$(pwd)/dist/vskit-1.55.13.vsix"
```

To install on another machine, copy the `.vsix` file there, open VS Code's Command Palette, run `Extensions: Install from VSIX...`, and select the file. Reload VS Code if prompted.

The current owner diagnostic-capture package is `1.55.13`; Marketplace publication remains paused.

### Diagnostics cho nút sparkle

Diagnostics are off by default. On the owner machine, enable `VSKit.ai.commitGenDiagnostics` in VS Code Settings, run the sparkle command (`VSKit.generateCommitMessage`) once, then run **VSKit: Show Commit Message Diagnostics** and copy the `VSKit: Commit Message Diagnostics` Output Channel. The channel records metadata and timings only; it does not include prompts, diffs, source, credentials, or generated response text.

### Dữ liệu từ cài đặt trước

VSKit has separate identity `lengockhoa.vskit`. It does not import prior `globalState`, `workspaceState`, or `SecretStorage`: connection profiles, database passwords, AI settings/API keys, query history/drafts, chat-session state, and schema filters/pins are not transferred. Existing extension data is left untouched. User/workspace settings files remain, but values under the previous namespace are not read. Recreate connections and reapply non-secret settings; enter passwords and API keys through VSKit forms.

AI chat sessions can be exported as Markdown/JSON from an existing installation, but VSKit has no importer; those files are archival only. Ordinary workspace SQL files are not moved or deleted. Keep the previous extension until you have recreated or archived anything you need.

## Kết nối

VSKit hỗ trợ 4 driver:

- **PostgreSQL** — host, port, user, password, database
- **MySQL** — host, port, user, password, database
- **MSSQL** — host, port, user, password, database (hỗ trợ bracket-quoted
  identifier)
- **BigQuery** — ADC (Application Default Credentials), billing project,
  location

Mỗi kết nối được lưu vào `VSKit.connections` globalState. Bạn có thể có
nhiều connection cùng lúc; "active connection" là connection đang hiển
thị trong Schema Explorer.

## Schema Explorer

Cây schema bên trái hiển thị:

- Schemas → Tables / Views / Routines / Types
- Mỗi table có các column (PK/UQ/FK marker)
- Mỗi view có column list
- Routine có parameter list

### Filter & Search

- Thanh filter phía trên cây schema — gõ để lọc theo tên bảng
- Dropdown "Select All" / "Deselect All" cho multi-select (khi áp dụng
  filter nâng cao)
- Hide system schemas — tùy chọn ẩn `pg_catalog`, `information_schema`

### Refresh

- Nút refresh thủ công trên title bar — invalidate toàn bộ schema
  cache + autocomplete + tree
- Tự động refresh sau khi chạy query (xem phần Results bên dưới)

## SQL Console

Mở SQL Console từ Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) bằng lệnh
**`VSKit: Open Console`**, hoặc bấm biểu tượng terminal trên thanh tiêu đề
Schema Explorer. Chuột phải vào connection, schema, category, table hoặc view
để dùng **Open Console for Object**; connection/schema/category mở tab SQL rỗng,
còn table/view mở tab có sẵn câu `SELECT` phù hợp với driver.

Trong Console:

- Gõ SQL vào editor rồi bấm **Run** hoặc nhấn `Cmd+Enter` (macOS) / `Ctrl+Enter` (Windows/Linux).
- Bôi đen một đoạn SQL rồi dùng **Run Selection** để chỉ chạy đoạn đã chọn.
- Dùng **+ Tab** để mở buffer SQL mới; mỗi connection giữ một console panel riêng.
- **History**, **Format**, **Explain**, **Explain Analyze** và **Save** có sẵn trên toolbar.

Mỗi connection có một console panel riêng (singleton) với:

- **Tabs** — mỗi tab là một buffer SQL độc lập
- **History** — lưu các lệnh đã chạy (10 cái gần nhất)
- **Drafts** — workspaceState lưu draft giữa các session
- **Open for Object** — chuột phải table/view/function → "Open Console for
  Object" mở tab mới với DDL pre-fill

### SQL Generator (R3+R4)

Chuột phải view hoặc routine → "SQL Generator" → mở console mới với
`CREATE VIEW ...` hoặc `CREATE FUNCTION ...` DDL pre-filled. DDL được
lấy qua `pg_get_viewdef()` / `pg_get_functiondef()` (PostgreSQL).

### Insert Sample Data (R1)

Chuột phải table → "Insert Sample Data…" → mở console mới với
`INSERT INTO schema.table ...` template (3 dòng mẫu + comment
`-- Edit values, then run`). User tự sửa values rồi Run (không tự
execute).

## Results

Kết quả SQL luôn mở ở panel dưới màn hình (cạnh tab Terminal) — không thể đổi vị trí.

### DDL/DML status card (R12)

Khi chạy `CREATE TABLE` / `DROP VIEW` / `INSERT ...` thành công, grid
không hiển thị bảng rỗng — thay vào đó hiển thị thẻ:

- ✅ Success — DDL/DML ran successfully: `<thông tin>`
- ❌ Failure — kèm error message

BigQuery path: vẫn giữ hành vi cũ (`kind === undefined`).

### Export

- CSV / JSON / TSV — copy header + rows
- Copy an toàn — paste vào spreadsheet hoặc JSON viewer

## AI Chat

Panel chat bên phải hỗ trợ nhiều engine (Claude / OpenAI / Ollama /
tùy chỉnh). Tính năng:

- **Thinking row** (R11) — khi user gửi message, một dòng "AI is
  thinking…" hiện dưới bubble user, có spinner. Tự ẩn khi có delta
  đầu tiên hoặc lỗi.
- **Code blocks** — fenced code block trong response render thành
  `<pre><code>` với nút copy (góc trên-phải). Click để copy raw code
  vào clipboard.
- **Inline code** — `<code>` với hover copy.
- **Truncation fix** (R9+R10) — bubble chat không tràn cột phải.

## Settings hub (R8b)

Bấm icon ⚙️ trên title bar của Schema Explorer để mở VS Code Settings đã lọc theo `VSKit`.
Các tùy chọn AI được khai báo gồm:

- `VSKit.ai.engine` — chọn `builtin`, `omp`, `claude-code` hoặc `codex`
- `VSKit.ai.grounding` — cho phép ngữ cảnh file trong workspace (mặc định `false`)

## Generate Commit Message

Trên title bar của panel **Source Control** xuất hiện thêm một nút
có biểu tượng chữ **U** làm hình chính, kèm sparkle nhỏ tách biệt — bấm vào nút để VSKit tự sinh commit
message theo chuẩn **Conventional Commits** rồi điền thẳng vào ô nhập
commit của SCM. Bạn chỉ cần review lại rồi bấm Commit.

- Nút chỉ hiện khi repository đang có thay đổi git (file staged hoặc
  unstaged).
- Nếu repo sạch, nút được disable và tooltip nhắc lý do.
- Tin nhắn được sinh bằng **Lite Model** mà bạn đã cấu hình trong AI
  Settings (mục tiếp theo). Model xử lý diff đã staged (ưu tiên) hoặc
  unstaged, có giới hạn kích thước — repo cực lớn sẽ được truncate.
- Nếu chưa cấu hình Lite Model, nút sparkle sẽ hiện toast hướng dẫn mở AI
  Settings (action `Open AI Settings`).
- Message theo chuẩn Conventional Commits với **type prefix tiếng Anh** và
  **subject/body tiếng Việt**, ví dụ: `feat(db): thêm chỉ mục cho bảng users`.
- Giới hạn độ dài để message gọn: subject tối đa **12 từ** (72 ký tự), toàn
  bộ message tối đa **100 từ** (600 ký tự).
- Nếu model trả về chuỗi rác (blob hash, câu suy luận, message tiếng Anh…),
  VSKit **tự động thử lại đúng 1 lần**; vẫn không hợp lệ thì hiện toast lỗi
  và **KHÔNG điền** vào ô commit để bạn không commit nhầm.

Trong panel **VSKit AI Settings** có một subsection riêng tên là
"Lite model" — đây là model thứ tư trong taxonomy
`work | smart | autocomplete | lite`, dùng riêng cho nút sparkle ở
Source Control.

- **Model ID** — bắt buộc điền. Bỏ trống = tính năng của nút sparkle bị
  disable (nút sẽ báo toast khi bấm).
> Lite section không còn dropdown Engine riêng. Nút sparkle dùng **đúng
> engine global** đang chọn ở panel trên (xem mục dưới). Nếu global là
> `omp` và omp khả dụng, sparkle sẽ chạy qua omp; nếu global là
> `builtin`, sparkle sẽ gọi OpenAI-compatible provider luôn (nhanh nhất
> cho commit message ngắn).

### Engine dropdown (global)

Trên cùng panel AI Settings có một dropdown **Engine** chung cho cả
chat panel và nút sparkle:

  - `omp` (mặc định cho fresh install) — dùng omp chat engine khi omp
    CLI đã cài; nếu không sẽ tự rơi về `builtin`.
  - `builtin` — OpenAI-compatible provider (OpenAI / Groq / LM Studio /
    OpenRouter …).
  - `claude-code` / `codex` — delegate sang agent ngoài khi tương ứng
    đã cài.

## User Guide (R2)

Bấm icon 📖 (book) trên title bar của Schema Explorer để mở file
`docs/vskit-user-guide.md`) trong Markdown preview.

## Schema Refresh (R13)

Sau khi chạy query thành công, Schema Explorer tự động refresh để
phản ánh trạng thái mới — không cần bấm refresh thủ công:

- **DDL** (CREATE / ALTER / DROP / COMMENT ON …) — full refresh:
  drop completion cache + autocomplete context cache + tree.
- **DML** (INSERT / UPDATE / DELETE / TRUNCATE / MERGE) — tree-only
  refresh (row count changed, không cần bust cache).
- **SELECT** — không refresh (chỉ đọc, schema không đổi).
- **Empty / failed batch** — không refresh.

Khi user chạy nhiều query liên tiếp, các refresh được coalesce qua
tree refresh.

## Phím tắt

Phím tắt hiện đang được hỗ trợ (xem `package.json → contributes.keybindings`):

| Phím tắt | Lệnh | Phạm vi |
| --- | --- | --- |
| **Cmd+Enter** (macOS) / **Ctrl+Enter** (Win/Linux) | Run statement (chạy câu lệnh đang chọn / dưới con trỏ) | Trong file `.sql` |
| **Cmd+Enter** (macOS) / **Ctrl+Enter** (Win/Linux) | Run selected shell lines in the integrated terminal | File `.sh` |

Trên macOS, phím tắt là `Cmd+Enter`; trên Windows / Linux là `Ctrl+Enter`. VS Code tự động remap
theo nền tảng — không cần cấu hình thêm.

Các lệnh khác có trong Command Palette. Gõ `VSKit:` để lọc lệnh của extension, chẳng hạn `VSKit: Cancel Query`, `VSKit: Open Console` hoặc `VSKit: AI Chat`.

## Troubleshooting

- **Connection refused** — kiểm tra host/port/firewall
- **Schema tree rỗng** — bấm refresh (hoặc chạy 1 query DDL/DML)
- **Console không mở** — bấm chuột phải vào table bất kỳ → Open Console
  for Object
- **AI Chat không phản hồi** — kiểm tra `VSKit.ai.engine` và cấu hình provider trong AI Settings.

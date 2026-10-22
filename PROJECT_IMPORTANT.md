# Project Important Instructions

## Tên và định danh chính thức — bắt buộc

Tên chính thức duy nhất của dự án là **VSKit**. Việc chuyển tên sang VSKit là quyết định đã chốt của owner.

1. Tuyệt đối không khôi phục hoặc đưa trở lại tên cũ, bao gồm `UnicDB`, `unicdb`, `UNICDB` và các biến thể, trong code hiện hành, manifest, cấu hình, command ID, view/container ID, context key, activation event, namespace, storage key mới, asset mới, UI, tài liệu hướng dẫn hiện hành hoặc artifact phát hành.

2. Không được dùng tên cũ làm alias, fallback, compatibility layer hoặc workaround để sửa bug. Không tự ý rollback toàn bộ hay một phần việc đổi tên, kể cả chỉ đổi định danh nội bộ trong khi giao diện vẫn ghi VSKit.

3. Khi tham khảo phiên bản trước đổi tên, chỉ tái sử dụng cơ chế hoặc logic cần thiết và chuyển mọi định danh liên quan sang VSKit một cách nhất quán. Đọc git history không có nghĩa được phép phục hồi tên cũ.

4. Mọi bản sửa phải giữ nhất quán định danh VSKit giữa khai báo command, menu, registerCommand, view/container, cấu hình, context key và activation. Nếu nghi việc đổi tên gây lỗi, phải sửa liên kết hoặc hành vi dưới định danh VSKit.

5. Không sửa test để hợp thức hóa việc khôi phục tên cũ. Test phải bảo vệ định danh VSKit và hành vi người dùng yêu cầu.

6. Nếu gặp trở ngại chỉ có thể giải quyết bằng tên cũ theo đánh giá của agent, phải báo bằng chứng và xin owner quyết định trước khi tiếp tục.

## Ship Pipeline (mandatory)

Sau khi update code xong, ship là BẮT BUỘC theo đúng thứ tự:

1. **Git** — commit + push lên remote.
2. **Git release** — tạo git tag/release tương ứng version.
Tạm thời dừng, không publish lên Marketplace nữa
3. **VS Marketplace** — publish bằng `vsce` (vsce publish). PAT nằm trong file `.pat` tại `.secrets/.pats/` — dùng `vsce publish -p "$(cat .secrets/.pats/.pat)"` (hoặc `vsce login` với PAT đó); không commit file PAT.

Không được dừng ở bước code xong; một lần ship chỉ coi là hoàn tất khi cả 3 bước trên đã chạy.

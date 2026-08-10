# Audit: `/sounds/*.mp3` đang trả HTML — chuông pomodoro không kêu trên production

> Lives in `docs/` as `.md`, **not** `docs/todo/*.todo`: `.gitignore` has a bare `todo`
> pattern (line 11), so anything under a `todo/` folder is invisible to git and this note
> would never have been committed. `☐` marks open items (platform convention).

Audit ngày 10/08/2026, lan ra từ gardener PR #106. **Read-only — chưa sửa gì.**

## Đây là bug ĐANG CHẠY, không phải tiềm ẩn

```
ui/src/features/pomodoro/useTimer.ts:18   const ALARM_SRC = "/sounds/alarm.mp3";
ui/src/features/pomodoro/useTimer.ts:75   const CLICK_SRC = "/sounds/click.mp3";
```

Hai file CÓ trong bundle nhúng: `internal/web/dist/sounds/{alarm.mp3,click.mp3}`.

Nhưng `internal/server/server.go` chỉ có:
- `s.app.Use("/assets", filesystem.New(...))`  ← dòng 85, chỉ phủ `/assets`
- `s.app.Get("/tomatime.svg", ...)`            ← dòng 92
- `s.app.Get("/*", ...)`                       ← dòng 99, catch-all render index.html

→ `/sounds/alarm.mp3` và `/sounds/click.mp3` rơi vào catch-all và trả **index.html với
status 200**. Không phải 404, nên log nhìn vẫn xanh. `<audio>` được đút HTML thì im lặng
không phát, cũng không báo lỗi gì lên UI.

**Nghĩa là báo hết hiệp và tiếng click của pomodoro không kêu trên app đã deploy.**
Chưa xác minh bằng cách chạy server thật (cần dựng DB) — bằng chứng là cơ học: không route
nào khớp `/sounds/...` ngoài `/*`.

## Todos

    ☐ Mount thư mục sounds, KHÔNG phải route từng file: thêm
      `s.app.Use("/sounds", filesystem.New(filesystem.Config{Root: http.FS(uiFS), PathPrefix: "sounds"}))`
      cạnh dòng 85 (`/assets` đã làm đúng kiểu này), đặt TRƯỚC catch-all.
      ⚠️ Cách của gardener (`app.Get("/:file", ...)` resolve từ embedded FS) **không cứu
      được chỗ này**: `/:file` chỉ khớp MỘT tầng, còn đây là hai (`/sounds/alarm.mp3`).
      Thư mục ở root cần mount riêng.
    ☐ Verify bằng REQUEST thật, không đọc code: `curl -I` (hoặc fetch) `/sounds/alarm.mp3`
      phải ra `audio/mpeg`, không phải `text/html`. Mọi đường dẫn đều trả 200 nên chỉ
      Content-Type mới phân biệt được đúng/sai.
    ☐ Trong lúc đó rà luôn shape chung: server hiện chỉ route 1 file root (`/tomatime.svg`)
      + catch-all. Thêm bất kỳ file tĩnh nào ở root sau này (manifest, apple-touch-icon,
      robots.txt, og-image) sẽ hỏng y hệt. Cân nhắc port `app.Get("/:file", ...)` của
      gardener để chặn cả lớp lỗi đó, cộng phần mount `/sounds` ở trên.
      ⚠️ Nếu có ngày thêm `manifest.webmanifest`: Go không có mime cho `.webmanifest`, và
      set Content-Type TRƯỚC `filesystem.SendFile` là vô ích (SendFile ghi đè → ra
      `application/octet-stream`, browser bỏ qua y như HTML). Phải đọc bytes rồi `c.Send`.

## Bối cảnh: cùng một lớp lỗi trên toàn platform

Repo nào embed UI sau một catch-all `GET /*` đều mắc mặc định.

| repo | trạng thái 10/08/2026 |
|---|---|
| rainy | ĐÃ SỬA — danh sách 4 tên cứng (`internal/server/server.go:91-105`) |
| gardener | ĐÃ SỬA — FS-resolve, PR #106 (manifest + icon + `sw.js` đều từng trả HTML) |
| **tomatime** | **ĐANG HỎNG — `/sounds/*.mp3`, note này** |
| isme, medioa2 | shape y hệt nhưng `ui/public/` chỉ có favicon.svg và nó có route → chưa hỏng |
| gobuild preset `platform-service` | tiềm ẩn; sinh ra đúng nhưng lan shape này — xem `gobuild/docs/pwa-root-file-audit.md` |
| memz | không áp dụng (không embed SPA) |

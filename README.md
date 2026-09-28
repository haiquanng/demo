# LênSàn · prototype

Bản mô phỏng agent vận hành đa sàn (Shopee, TikTok Shop, Lazada) cho enabler.
Brand, dữ liệu, luật và phản hồi của sàn đều là ví dụ. Agent chưa gọi model thật.

## Chạy

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # ra dist/index.html, một file duy nhất, mở trực tiếp được
```

## Đường dẫn

- `/len-san`: thả catalog, 3 agent dựng listing, review như PR (gọi Gemini thật qua `/api`)
- `/sync-guard`, `/campaign`, `/koc-claim`, `/policy-watch`: các module "sau khi lên sàn", chạy theo kịch bản
- `/len-san?autostart=live` tự chạy catalog mẫu với Gemini, `?autostart=cache` chạy bản ghi sẵn

Các trang luôn được gắn nên chuyển tab không mất dữ liệu. Phiên review được lưu trong sessionStorage nên tải lại trang vẫn còn.

## Cấu trúc

- `src/lib/scenario.ts`: cơ chế chạy kịch bản từng bước, dùng chung cho mọi module
- `src/modules/`: Tổng quan, Launch, Sync Guard, Campaign, KOC Claim Watch, Policy Watch
- `src/data/`: dữ liệu mô phỏng
- `prototype-v1/`: bản HTML đầu tiên, chỉ có Launch

## Lưu ý cho ngày thi

Luật thi không cho nộp code viết sẵn. Bản này dùng để nộp đơn, xin góp ý và tập demo.
Ngày thi phải viết lại từ đầu.
# demo

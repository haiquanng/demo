# Gọi thử bằng AI (Twilio + Gemini Live)

Nhập số điện thoại, bấm gọi. Twilio gọi vào máy bạn, Gemini nói chuyện trực tiếp qua luồng âm thanh,
ghi lời thoại và kết quả (xác nhận, dời lịch, hủy).

## Chuẩn bị (miễn phí)

1. **Twilio dùng thử** tại twilio.com: có sẵn credit dùng thử và một số điện thoại Mỹ.
   - Console → Phone Numbers → **Verified Caller IDs**: xác minh số di động của bạn. Tài khoản dùng thử chỉ gọi được tới số đã xác minh.
   - Voice → Settings → **Geo Permissions**: bật **Vietnam**.
   - Lấy Account SID, Auth Token và số Twilio ở trang chủ Console.
2. **Đường hầm public** để Twilio gọi ngược về máy bạn, không cần tài khoản:
   `brew install cloudflared` rồi `cloudflared tunnel --url http://localhost:8787`, chép địa chỉ `https://….trycloudflare.com`.
3. Chép `.env.example` thành `.env`, điền các giá trị trên và `GEMINI_API_KEY`.

## Chạy

```bash
npm install
npm start          # mở http://localhost:8787
```

## Lưu ý

- Tài khoản dùng thử: đầu cuộc gọi có lời nhắc của Twilio, phải bấm một phím mới vào cuộc gọi. Nâng cấp tài khoản thì hết.
- Cuộc gọi sang Việt Nam trừ vào credit dùng thử. Gemini Live dùng hạn mức miễn phí của key.
- AI mất khoảng 3 giây sau khi bắt máy để mở lời, do phải kết nối Gemini.
- Chỉ gọi cho người đã đồng ý nhận cuộc gọi.

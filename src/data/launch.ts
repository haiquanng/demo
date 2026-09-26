import type { PlatId } from "./common";

export const REQ: Record<PlatId, string[]> = {
  sp: ["Thương hiệu", "Quy cách", "Xuất xứ", "Hạn sử dụng"],
  tt: ["Thương hiệu", "Quy cách", "Số công bố"],
  lz: ["Thương hiệu", "Quy cách", "Phù hợp với", "Số công bố"],
};

export interface Product {
  id: string;
  name: string;
  short: string;
  hue: number;
  size: string;
  fit: string | null;
  fitGuess?: string;
  fitWhy?: string;
  conflict?: { from: string; to: string };
  cb: string;
  hsd: string;
  src: string;
  flag?: string;
}

export const PRODUCTS: Product[] = [
  { id: "P1", name: "Serum Vitamin C 15%", short: "VC", hue: 34, size: "30ml", fit: "Da xỉn màu, thâm", cb: "2154/26/CBMP-HCM", hsd: "24 tháng", src: "PDF tr.3 · Excel dòng 2" },
  { id: "P2", name: "Sữa rửa mặt trà xanh", short: "TX", hue: 118, size: "150ml", fit: "Da dầu, mụn", cb: "2155/26/CBMP-HCM", hsd: "36 tháng", src: "PDF tr.5 · Excel dòng 3" },
  { id: "P3", name: "Kem chống nắng SPF50+ PA++++", short: "CN", hue: 50, size: "50ml", fit: null, fitGuess: "Mọi loại da", fitWhy: 'câu "phù hợp cả da dầu và da khô" ở PDF tr.6', cb: "2156/26/CBMP-HCM", hsd: "24 tháng", src: "PDF tr.6 · Excel dòng 4", flag: "Thiếu thông tin loại da phù hợp" },
  { id: "P4", name: "Dầu gội bưởi", short: "BG", hue: 352, size: "300ml", fit: "Tóc dầu, dễ gãy rụng", cb: "2157/26/CBMP-HCM", hsd: "36 tháng", src: "PDF tr.8 · Ảnh fanpage #11" },
  { id: "P5", name: "Son dưỡng dầu dừa", short: "SD", hue: 14, size: "4g", conflict: { from: "4g", to: "3,5g" }, fit: "Môi khô", cb: "2158/26/CBMP-HCM", hsd: "24 tháng", src: "PDF tr.10 · Excel dòng 6", flag: "PDF ghi 4g, Excel ghi 3,5g" },
  { id: "P6", name: "Mặt nạ ngủ rau má", short: "RM", hue: 96, size: "80g", fit: "Da nhạy cảm", cb: "2159/26/CBMP-HCM", hsd: "24 tháng", src: "PDF tr.12 · Excel dòng 7" },
];
export const P: Record<string, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export const TITLES: Record<string, Record<PlatId, string>> = {
  P1: { sp: "Serum Vitamin C 15% Hạ Vy Botanics 30ml làm sáng da, trị dứt điểm nám", tt: "【Chính Hãng】 Serum Vitamin C 15% Hạ Vy 30ml trị dứt điểm nám", lz: "Hạ Vy Botanics Serum Vitamin C 15% 30ml Làm Sáng Da, Trị Dứt Điểm Nám" },
  P2: { sp: "Sữa rửa mặt trà xanh Hạ Vy Botanics 150ml cho da dầu mụn", tt: "Sữa rửa mặt trà xanh Hạ Vy 150ml – chính hãng như trên Shopee Mall", lz: "Hạ Vy Botanics Sữa Rửa Mặt Trà Xanh 150ml Cho Da Dầu Mụn" },
  P3: { sp: "Kem chống nắng Hạ Vy Botanics SPF50+ PA++++ 50ml nâng tông nhẹ", tt: "【Chính Hãng】 Kem chống nắng Hạ Vy SPF50+ PA++++ 50ml", lz: "Hạ Vy Botanics Kem Chống Nắng SPF50+ PA++++ 50ml" },
  P4: { sp: "Dầu gội bưởi Hạ Vy Botanics 300ml kích mọc tóc, chữa rụng tóc", tt: "Dầu gội bưởi Hạ Vy 300ml kích mọc tóc, chữa rụng tóc", lz: "Hạ Vy Botanics Dầu Gội Bưởi 300ml Kích Mọc Tóc, Chữa Rụng Tóc" },
  P5: { sp: "Son dưỡng dầu dừa Hạ Vy Botanics 4g cho môi khô", tt: "【Chính Hãng】 Son dưỡng dầu dừa Hạ Vy 4g", lz: "Hạ Vy Botanics Son Dưỡng Dầu Dừa 4g" },
  P6: { sp: "Mặt nạ ngủ rau má Hạ Vy Botanics 80g cho da nhạy cảm", tt: "Mặt nạ ngủ rau má Hạ Vy 80g", lz: "Hạ Vy Botanics Mặt Nạ Ngủ Rau Má 80g" },
};

export const SAFE: Record<string, string> = { P1: "hỗ trợ làm mờ thâm nám", P4: "hỗ trợ giảm gãy rụng" };

const beautySp = "Sắc Đẹp", beautyTt = "Làm đẹp & Chăm sóc cá nhân", beautyLz = "Sức khỏe & Làm đẹp";
export const CATS: Record<string, Record<PlatId, string[]>> = {
  P1: { sp: [beautySp, "Chăm sóc da mặt", "Serum & Tinh chất"], tt: [beautyTt, "Chăm sóc da", "Tinh chất"], lz: [beautyLz, "Chăm sóc da", "Serum & Tinh chất"] },
  P2: { sp: [beautySp, "Chăm sóc da mặt", "Sữa rửa mặt"], tt: [beautyTt, "Chăm sóc da", "Làm sạch da mặt"], lz: [beautyLz, "Chăm sóc da", "Sữa rửa mặt"] },
  P3: { sp: [beautySp, "Chống nắng", "Kem chống nắng mặt"], tt: [beautyTt, "Chăm sóc da", "Chống nắng"], lz: [beautyLz, "Chăm sóc da", "Chống nắng"] },
  P4: { sp: [beautySp, "Chăm sóc tóc", "Dầu gội"], tt: [beautyTt, "Chăm sóc tóc", "Dầu gội"], lz: [beautyLz, "Chăm sóc tóc", "Dầu gội"] },
  P5: { sp: [beautySp, "Trang điểm môi", "Son dưỡng"], tt: [beautyTt, "Trang điểm", "Môi"], lz: [beautyLz, "Trang điểm", "Son dưỡng môi"] },
  P6: { sp: [beautySp, "Chăm sóc da mặt", "Mặt nạ"], tt: [beautyTt, "Chăm sóc da", "Mặt nạ"], lz: [beautyLz, "Chăm sóc da", "Mặt nạ ngủ"] },
};

export const STICKERS: Record<string, string> = { P2: "FREESHIP", P6: "SALE 50%" };

export interface Rule { id: string; plat: PlatId | "all"; text: string; src: string }

export const RULES_BASE: Rule[] = [
  { id: "R-01", plat: "all", text: 'Mỹ phẩm không được tuyên bố công dụng điều trị như "trị dứt điểm", "chữa", "đặc trị".', src: "Nạp sẵn · quy định quảng cáo mỹ phẩm" },
  { id: "R-02", plat: "tt", text: "Không nhắc tên sàn khác trong tiêu đề và mô tả.", src: "Nạp sẵn · chính sách nội dung TikTok Shop" },
  { id: "R-03", plat: "all", text: "Điền đủ thuộc tính bắt buộc của từng sàn. Giá trị agent tự suy ra phải có người xác nhận.", src: "Nạp sẵn" },
  { id: "R-04", plat: "sp", text: "Tiêu đề tối đa 120 ký tự.", src: "Nạp sẵn" },
  { id: "R-05", plat: "all", text: "Quy cách phải khớp giữa các nguồn catalog trước khi đăng.", src: "Nạp sẵn · quy trình nội bộ" },
  { id: "R-06", plat: "all", text: "Danh mục có độ tin cậy dưới 80% phải có người xác nhận.", src: "Nạp sẵn · quy trình nội bộ" },
];

export const NOTICE_TT =
  "[TikTok Shop] Cập nhật quy định nội dung sản phẩm: Từ ngày 01/11/2026, tiêu đề sản phẩm không được chứa emoji hoặc ký tự trang trí (ví dụ 【】, ★, 🔥). Sản phẩm vi phạm sẽ bị hạn chế hiển thị cho đến khi được chỉnh sửa.";

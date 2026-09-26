export type PlatId = "sp" | "tt" | "lz";

export const PLATS: { id: PlatId; name: string }[] = [
  { id: "sp", name: "Shopee" },
  { id: "tt", name: "TikTok Shop" },
  { id: "lz", name: "Lazada" },
];
export const PNAME: Record<PlatId, string> = { sp: "Shopee", tt: "TikTok Shop", lz: "Lazada" };

/** Các brand giả lập mà enabler đang vận hành. */
export const BRANDS = [
  { id: "hv", name: "Hạ Vy Botanics", industry: "Mỹ phẩm", skus: 6, stage: "Đang onboard, mở bán 03/10" },
  { id: "ta", name: "Gỗ Tâm An", industry: "Nhà cửa & đời sống", skus: 24, stage: "Đang bán" },
  { id: "bn", name: "Bông Nhỏ", industry: "Mẹ & bé", skus: 41, stage: "Đang bán, chạy 10.10" },
] as const;
export type BrandId = (typeof BRANDS)[number]["id"];
export const BNAME: Record<BrandId, string> = Object.fromEntries(BRANDS.map((b) => [b.id, b.name])) as Record<BrandId, string>;

/** Ngày "hôm nay" trong bản mô phỏng. */
export const TODAY = new Date(2026, 8, 26);

export const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
export const pct = (n: number, d = 1) => n.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";

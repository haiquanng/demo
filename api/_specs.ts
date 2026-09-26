/* Kiểu dữ liệu, đặc tả sàn và luật nền. Không dùng API của Node để giao diện import được. */

export type PlatId = "sp" | "tt" | "lz";

export interface Source { text: string; source: string }
export interface Product {
  id: string;
  name: string;
  brand: string;
  size: string;
  price: number;
  sku: string | null;
  claims: Source[];
  facts: { key: string; value: string; source: string }[];
  flags: { kind: "conflict" | "missing" | "risky"; field: string; detail: string }[];
}
export interface Issue {
  ruleId: string;
  severity: "bad" | "warn";
  field: "title" | "attribute" | "category" | "description";
  phrase: string | null;
  reason: string;
  fix: { from: string | null; to: string; label: string };
}
export interface Listing {
  productId: string;
  categoryPath: string[];
  categoryConfidence: number;
  categoryAlternative: string[] | null;
  title: string;
  attributes: { key: string; value: string | null; source: string; inferred: boolean }[];
  price: number;
  issues: Issue[];
  decision: { summary: string; evidence: Source[]; tradeoff: string; next: string };
}
export interface Rule { id: string; plat: PlatId | "all"; text: string; source: string }

export interface PlatformSpec {
  id: PlatId;
  name: string;
  titleRule: string;
  required: string[];
  categories: string[];
}

/** Đặc tả sàn rút gọn để minh họa. Khi làm thật sẽ lấy từ API danh mục và thuộc tính của từng sàn. */
export const PLATFORMS: PlatformSpec[] = [
  {
    id: "sp",
    name: "Shopee",
    titleRule: "Tên sản phẩm + thương hiệu + công dụng chính + quy cách. Tối đa 120 ký tự. Không viết hoa toàn bộ, không ký tự trang trí.",
    required: ["Thương hiệu", "Quy cách", "Xuất xứ", "Hạn sử dụng", "Số công bố"],
    categories: [
      "Sắc Đẹp > Chăm sóc da mặt > Serum & Tinh chất",
      "Sắc Đẹp > Chăm sóc da mặt > Sữa rửa mặt",
      "Sắc Đẹp > Chăm sóc da mặt > Mặt nạ",
      "Sắc Đẹp > Chăm sóc da mặt > Kem dưỡng",
      "Sắc Đẹp > Chống nắng > Kem chống nắng mặt",
      "Sắc Đẹp > Chống nắng > Chống nắng cơ thể",
      "Sắc Đẹp > Chăm sóc tóc > Dầu gội",
      "Sắc Đẹp > Chăm sóc tóc > Dầu gội trị gàu",
      "Sắc Đẹp > Chăm sóc tóc > Dầu xả",
      "Sắc Đẹp > Trang điểm môi > Son dưỡng",
      "Sắc Đẹp > Trang điểm môi > Son màu",
    ],
  },
  {
    id: "tt",
    name: "TikTok Shop",
    titleRule: "Ngắn gọn, tối đa 100 ký tự, nêu lợi ích chính trước. Không nhắc tên sàn khác. Không cam kết công dụng điều trị.",
    required: ["Thương hiệu", "Quy cách", "Số công bố"],
    categories: [
      "Làm đẹp & Chăm sóc cá nhân > Chăm sóc da > Tinh chất",
      "Làm đẹp & Chăm sóc cá nhân > Chăm sóc da > Làm sạch da mặt",
      "Làm đẹp & Chăm sóc cá nhân > Chăm sóc da > Mặt nạ",
      "Làm đẹp & Chăm sóc cá nhân > Chăm sóc da > Chống nắng",
      "Làm đẹp & Chăm sóc cá nhân > Chăm sóc tóc > Dầu gội",
      "Làm đẹp & Chăm sóc cá nhân > Chăm sóc tóc > Điều trị tóc",
      "Làm đẹp & Chăm sóc cá nhân > Trang điểm > Môi",
    ],
  },
  {
    id: "lz",
    name: "Lazada",
    titleRule: "Bắt đầu bằng thương hiệu, viết hoa chữ cái đầu mỗi từ, tối đa 120 ký tự.",
    required: ["Thương hiệu", "Quy cách", "Phù hợp với", "Số công bố"],
    categories: [
      "Sức khỏe & Làm đẹp > Chăm sóc da > Serum & Tinh chất",
      "Sức khỏe & Làm đẹp > Chăm sóc da > Sữa rửa mặt",
      "Sức khỏe & Làm đẹp > Chăm sóc da > Mặt nạ ngủ",
      "Sức khỏe & Làm đẹp > Chăm sóc da > Chống nắng",
      "Sức khỏe & Làm đẹp > Chăm sóc tóc > Dầu gội",
      "Sức khỏe & Làm đẹp > Trang điểm > Son dưỡng môi",
    ],
  },
];

export const RULES_BASE: Rule[] = [
  { id: "R-01", plat: "all", text: "Mỹ phẩm không được tuyên bố công dụng điều trị hoặc cam kết kết quả như \"trị dứt điểm\", \"chữa\", \"đặc trị\", \"kích mọc tóc\".", source: "Nạp sẵn · quy định quảng cáo mỹ phẩm" },
  { id: "R-02", plat: "tt", text: "Không nhắc tên sàn khác (Shopee, Lazada…) trong tiêu đề và mô tả.", source: "Nạp sẵn · chính sách nội dung TikTok Shop" },
  { id: "R-03", plat: "all", text: "Điền đủ thuộc tính bắt buộc của từng sàn. Giá trị agent tự suy ra phải được đánh dấu để người xác nhận.", source: "Nạp sẵn" },
  { id: "R-04", plat: "all", text: "Tiêu đề phải theo quy ước và giới hạn ký tự của từng sàn.", source: "Nạp sẵn" },
  { id: "R-05", plat: "all", text: "Quy cách và giá phải khớp giữa các nguồn catalog. Khi lệch, ưu tiên nguồn mới hơn nhưng phải có người xác nhận.", source: "Nạp sẵn · quy trình nội bộ" },
  { id: "R-06", plat: "all", text: "Danh mục có độ tin cậy dưới 0.8 phải có người xác nhận.", source: "Nạp sẵn · quy trình nội bộ" },
];

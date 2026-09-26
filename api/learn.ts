import { LEARN_SCHEMA, SYSTEM, gemini, type Rule } from "./_shared.js";

interface Item { productId: string; name: string; titles: Record<string, string>; claims: string[] }
export interface Learned {
  rule: { plat: Rule["plat"]; text: string };
  explanation: string;
  affected: { productId: string; field: "title" | "description"; phrase: string; replacement: string; label: string }[];
}

/** Đọc thông báo từ chối hoặc đổi chính sách, rút ra luật mới và tìm mọi sản phẩm đang vi phạm luật đó. */
export async function POST(req: Request): Promise<Response> {
  const { notice, items, rules } = (await req.json()) as { notice: string; items: Item[]; rules: Rule[] };
  const prompt = `Thông báo vừa nhận từ sàn:
"""${notice}"""

Sổ luật hiện có:
${rules.map((r) => `${r.id} (${r.plat}): ${r.text}`).join("\n")}

Sản phẩm đang bán. titles là tiêu đề trên từng sàn (sp = Shopee, tt = TikTok Shop, lz = Lazada). claims là các câu quảng cáo nằm trong phần mô tả:
${JSON.stringify(items)}

Việc cần làm:
1. rule: MỘT luật mới ngắn gọn, dùng được cho lần sau. plat là sàn áp dụng, "all" nếu hợp lý cho mọi sàn.
2. explanation: 1-2 câu giải thích agent hiểu thông báo thế nào.
3. affected: mọi sản phẩm có tiêu đề hoặc câu mô tả vi phạm luật mới, kể cả sản phẩm vừa bị từ chối. phrase phải là đoạn chữ xuất hiện NGUYÊN VĂN trong titles hoặc claims. replacement là câu thay thế an toàn, không rỗng. label tối đa 6 từ.`;
  try {
    const { data, model } = await gemini<Learned>([{ text: prompt }], LEARN_SCHEMA, SYSTEM);
    return Response.json({ ...data, model });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

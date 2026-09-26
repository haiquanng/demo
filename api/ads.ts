import { ADS_SCHEMA, PLATFORMS, SYSTEM, gemini, type Product, type Rule } from "./_shared.js";

export interface AdsKit {
  intents: string[];
  ad: { headline: string; description: string; cta: string };
  keywords: { keyword: string; intent: "mua ngay" | "so sánh" | "tìm hiểu"; note: string }[];
  seoTitles: { plat: "sp" | "tt" | "lz"; title: string }[];
  facts: { q: string; a: string; source: string }[];
  softened: { original: string; replacement: string; ruleId: string }[];
}

/** Tạo bộ nội dung quảng cáo cho một sản phẩm: thẻ tài trợ trên ChatGPT, từ khóa tìm kiếm trên sàn, tiêu đề SEO và dữ kiện để AI trích dẫn. */
export async function POST(req: Request): Promise<Response> {
  const { product, titles, rules } = (await req.json()) as { product: Product; titles: Record<string, string>; rules: Rule[] };
  const prompt = `Sản phẩm (dữ liệu gốc, có nguồn):
${JSON.stringify(product)}

Tiêu đề đang dùng trên sàn: ${JSON.stringify(titles)}
Quy ước tiêu đề từng sàn:
${PLATFORMS.map((p) => `${p.id} (${p.name}): ${p.titleRule}`).join("\n")}

Sổ luật (nội dung quảng cáo cũng phải tuân thủ):
${rules.map((r) => `${r.id} (${r.plat}): ${r.text}`).join("\n")}

Quảng cáo trên ChatGPT hiển thị dạng thẻ tài trợ dưới câu trả lời và được chọn theo NGỮ CẢNH hội thoại, không theo từ khóa. Hãy tạo:
1. intents: 5 câu người mua Việt Nam có thể hỏi ChatGPT mà sản phẩm này là câu trả lời phù hợp. Viết tự nhiên như người thật gõ, có nhu cầu, ngân sách hoặc tình huống cụ thể.
2. ad: headline tối đa 40 ký tự, description tối đa 110 ký tự, cta tối đa 3 từ. Nói lợi ích có căn cứ trong dữ liệu gốc, không cam kết điều trị, không nêu mốc thời gian hiệu quả, không nhắc tên sàn.
3. keywords: 6 từ khóa người mua gõ trong ô tìm kiếm của Shopee hoặc TikTok Shop, kèm ý định và ghi chú ngắn vì sao chọn.
4. seoTitles: tiêu đề tối ưu tìm kiếm cho cả 3 sàn (sp, tt, lz), theo quy ước từng sàn, tuân thủ Sổ luật, đưa từ khóa quan trọng lên đầu.
5. facts: 4 cặp hỏi đáp ngắn dựa hoàn toàn trên dữ liệu gốc, kèm nguồn, để trang sản phẩm có dữ kiện rõ ràng cho các trợ lý AI trích dẫn.
6. softened: các câu trong catalog đã phải viết lại cho an toàn, với ruleId tương ứng.`;
  try {
    const { data, model } = await gemini<AdsKit>([{ text: prompt }], ADS_SCHEMA, SYSTEM);
    return Response.json({ ...data, model });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

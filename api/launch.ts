import { LISTING_SCHEMA, PLATFORMS, PRODUCTS_SCHEMA, RULES_BASE, SYSTEM, gemini, ndjson, type Listing, type Part, type Product, type Rule } from "./_shared.js";

interface InFile { name: string; mime: string; data?: string; text?: string }

export async function POST(req: Request): Promise<Response> {
  const { files, rules } = (await req.json()) as { files: InFile[]; rules?: Rule[] };
  const ruleBook = rules?.length ? rules : RULES_BASE;

  return ndjson(async (send) => {
    const t0 = Date.now();
    send({ type: "stage", stage: "read" });

    /* Bước 1: đọc mọi nguồn thành một bản dữ liệu gốc cho mỗi sản phẩm. */
    const parts: Part[] = [];
    for (const f of files) {
      parts.push({ text: `--- Nguồn: ${f.name} ---` });
      if (f.data) parts.push({ inline_data: { mime_type: f.mime, data: f.data } });
      else parts.push({ text: f.text ?? "" });
    }
    parts.push({
      text: `Đọc tất cả nguồn trên của cùng một brand và tạo bản dữ liệu gốc cho từng sản phẩm.
- Ghép cùng một sản phẩm giữa các nguồn dù tên viết tắt khác nhau.
- id dạng P1, P2... theo thứ tự trong catalog.
- claims: chép nguyên văn các câu quảng cáo công dụng, kèm nguồn.
- facts: số công bố, hạn sử dụng, xuất xứ, loại da hoặc tóc phù hợp, thành phần chính nếu có. Mỗi fact có nguồn.
- flags: "conflict" khi các nguồn lệch nhau (ghi rõ nguồn nào ghi gì), "missing" khi thiếu thông tin mà sàn thường yêu cầu, "risky" khi câu quảng cáo có nguy cơ vi phạm. Viết detail ngắn, tối đa 25 từ.
- price: giá bán lẻ bằng số VNĐ. size: quy cách theo nguồn mới nhất.`,
    });
    const { data: ext, model } = await gemini<{ products: Product[] }>(parts, PRODUCTS_SCHEMA, SYSTEM);
    send({ type: "model", model });
    for (const p of ext.products) send({ type: "product", product: p });
    send({ type: "stage", stage: "build", ms: Date.now() - t0 });

    /* Bước 2: mỗi sàn một agent. Mỗi agent dựng từng sản phẩm song song để thẻ hiện lên dần. */
    await Promise.all(
      PLATFORMS.map(async (pl) => {
        const t = Date.now();
        send({ type: "agent", plat: pl.id, status: "running" });
        const rules = ruleBook.filter((r) => r.plat === "all" || r.plat === pl.id).map((r) => `${r.id}: ${r.text}`).join("\n");
        let count = 0;
        await Promise.all(
          ext.products.map(async (p) => {
            const prompt = `Bạn là agent phụ trách sàn ${pl.name}. Dựng listing cho sản phẩm dưới đây.

Quy ước tiêu đề của ${pl.name}: ${pl.titleRule}
Thuộc tính bắt buộc: ${pl.required.join(", ")}
Cây danh mục được phép chọn (chỉ chọn trong danh sách này, tách theo " > "):
${pl.categories.join("\n")}

Sổ luật đang áp dụng:
${rules}

Yêu cầu:
- productId = "${p.id}".
- title: viết đúng quy ước sàn. Đây là bản nháp trung thực từ catalog: nếu catalog có câu vi phạm thì vẫn giữ trong tiêu đề nháp và báo issue, để người duyệt thấy rõ trước và sau.
- attributes: đủ mọi thuộc tính bắt buộc. value = null nếu không tìm thấy. inferred = true nếu phải suy luận.
- categoryConfidence từ 0 đến 1. categoryAlternative là phương án thứ hai nếu phân vân, không thì null.
- issues: chỉ báo lỗi dựa trên Sổ luật, ghi ruleId. phrase là đoạn chữ chính xác trong title bị lỗi (hoặc null). fix.from là đoạn cần thay, khớp chính xác với title nếu field là title. fix.to là nội dung thay thế an toàn. fix.label là nút bấm ngắn, tối đa 6 từ.
- decision: summary 1 câu vì sao chọn danh mục và tiêu đề này. evidence 2-3 bằng chứng có nguồn. tradeoff 1 câu. next 1 câu việc người duyệt cần làm. Viết ngắn gọn.

Sản phẩm:
${JSON.stringify(p)}`;
            const { data } = await gemini<Listing>([{ text: prompt }], LISTING_SCHEMA, SYSTEM);
            data.productId = p.id;
            count++;
            send({ type: "listing", plat: pl.id, listing: data });
          }),
        );
        send({ type: "agent", plat: pl.id, status: "done", ms: Date.now() - t, count });
      }),
    );
    send({ type: "stage", stage: "review", ms: Date.now() - t0 });
    send({ type: "done", ms: Date.now() - t0 });
  });
}

/* Dùng chung cho các serverless function. File bắt đầu bằng "_" nên Vercel không biến nó thành endpoint. */

export * from "./_specs.js";

/* ---------- Schema cho structured output của Gemini ---------- */

const S = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra });
const srcSchema = S("OBJECT", { properties: { text: S("STRING"), source: S("STRING") }, required: ["text", "source"] });

export const PRODUCTS_SCHEMA = S("OBJECT", {
  properties: {
    products: S("ARRAY", {
      items: S("OBJECT", {
        properties: {
          id: S("STRING"),
          name: S("STRING"),
          brand: S("STRING"),
          size: S("STRING"),
          price: S("NUMBER"),
          sku: S("STRING", { nullable: true }),
          claims: S("ARRAY", { items: srcSchema }),
          facts: S("ARRAY", { items: S("OBJECT", { properties: { key: S("STRING"), value: S("STRING"), source: S("STRING") }, required: ["key", "value", "source"] }) }),
          flags: S("ARRAY", { items: S("OBJECT", { properties: { kind: S("STRING", { enum: ["conflict", "missing", "risky"] }), field: S("STRING"), detail: S("STRING") }, required: ["kind", "field", "detail"] }) }),
        },
        required: ["id", "name", "brand", "size", "price", "sku", "claims", "facts", "flags"],
      }),
    }),
  },
  required: ["products"],
});

const issueSchema = S("OBJECT", {
  properties: {
    ruleId: S("STRING"),
    severity: S("STRING", { enum: ["bad", "warn"] }),
    field: S("STRING", { enum: ["title", "attribute", "category", "description"] }),
    phrase: S("STRING", { nullable: true }),
    reason: S("STRING"),
    fix: S("OBJECT", { properties: { from: S("STRING", { nullable: true }), to: S("STRING"), label: S("STRING") }, required: ["from", "to", "label"] }),
  },
  required: ["ruleId", "severity", "field", "phrase", "reason", "fix"],
});

export const LISTING_SCHEMA = S("OBJECT", {
        properties: {
          productId: S("STRING"),
          categoryPath: S("ARRAY", { items: S("STRING") }),
          categoryConfidence: S("NUMBER"),
          categoryAlternative: S("ARRAY", { items: S("STRING"), nullable: true }),
          title: S("STRING"),
          attributes: S("ARRAY", { items: S("OBJECT", { properties: { key: S("STRING"), value: S("STRING", { nullable: true }), source: S("STRING"), inferred: S("BOOLEAN") }, required: ["key", "value", "source", "inferred"] }) }),
          price: S("NUMBER"),
          issues: S("ARRAY", { items: issueSchema }),
          decision: S("OBJECT", {
            properties: { summary: S("STRING"), evidence: S("ARRAY", { items: srcSchema }), tradeoff: S("STRING"), next: S("STRING") },
            required: ["summary", "evidence", "tradeoff", "next"],
          }),
        },
        required: ["productId", "categoryPath", "categoryConfidence", "categoryAlternative", "title", "attributes", "price", "issues", "decision"],
});

export const LEARN_SCHEMA = S("OBJECT", {
  properties: {
    rule: S("OBJECT", { properties: { plat: S("STRING", { enum: ["sp", "tt", "lz", "all"] }), text: S("STRING") }, required: ["plat", "text"] }),
    explanation: S("STRING"),
    affected: S("ARRAY", {
      items: S("OBJECT", {
        properties: { productId: S("STRING"), field: S("STRING", { enum: ["title", "description"] }), phrase: S("STRING"), replacement: S("STRING"), label: S("STRING") },
        required: ["productId", "field", "phrase", "replacement", "label"],
      }),
    }),
  },
  required: ["rule", "explanation", "affected"],
});

/* ---------- Gọi Gemini ---------- */

export const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function gemini<T>(parts: Part[], schema: unknown, system: string, thinking: "low" | "high" = "low"): Promise<{ data: T; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Thiếu GEMINI_API_KEY trên server.");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2, thinkingConfig: { thinkingLevel: thinking } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `Gemini trả về lỗi ${res.status}`);
  const text = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return { data: JSON.parse(text) as T, model: body.modelVersion ?? MODEL };
}

export const SYSTEM = `Bạn là agent vận hành thương mại điện tử cho một enabler ở Việt Nam, chuyên đưa sản phẩm của brand lên Shopee, TikTok Shop và Lazada.
Luôn trả lời bằng tiếng Việt có dấu. Không bịa thông tin không có trong nguồn. Mỗi thông tin phải ghi nguồn ngắn gọn như "PDF tr.2", "CSV dòng 6", "PDF chân trang".
Khi phải suy luận, ghi rõ là suy luận và vì sao.`;

/** Luồng NDJSON: mỗi dòng một sự kiện JSON. */
export function ndjson(run: (send: (ev: unknown) => void) => Promise<void>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (ev: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      try {
        await run(send);
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export const ADS_SCHEMA = S("OBJECT", {
  properties: {
    intents: S("ARRAY", { items: S("STRING") }),
    ad: S("OBJECT", { properties: { headline: S("STRING"), description: S("STRING"), cta: S("STRING") }, required: ["headline", "description", "cta"] }),
    keywords: S("ARRAY", {
      items: S("OBJECT", { properties: { keyword: S("STRING"), intent: S("STRING", { enum: ["mua ngay", "so sánh", "tìm hiểu"] }), note: S("STRING") }, required: ["keyword", "intent", "note"] }),
    }),
    seoTitles: S("ARRAY", { items: S("OBJECT", { properties: { plat: S("STRING", { enum: ["sp", "tt", "lz"] }), title: S("STRING") }, required: ["plat", "title"] }) }),
    facts: S("ARRAY", { items: S("OBJECT", { properties: { q: S("STRING"), a: S("STRING"), source: S("STRING") }, required: ["q", "a", "source"] }) }),
    softened: S("ARRAY", { items: S("OBJECT", { properties: { original: S("STRING"), replacement: S("STRING"), ruleId: S("STRING") }, required: ["original", "replacement", "ruleId"] }) }),
  },
  required: ["intents", "ad", "keywords", "seoTitles", "facts", "softened"],
});

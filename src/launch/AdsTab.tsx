import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Loader2, MessageSquareText, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import { PLATFORMS, type PlatId } from "../../api/_specs";
import { PNAME, keyOf, type AdsKit, type State } from "./useLaunch";

const INTENT_UI = { "mua ngay": "bg-ok/10 text-ok", "so sánh": "bg-brand/10 text-brand", "tìm hiểu": "bg-surface-2 text-ink-soft" } as const;

function Section({ icon, title, note, children }: { icon: React.ReactNode; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <header className="flex items-baseline justify-between gap-2">
        <h4 className="m-0 inline-flex items-center gap-1.5 text-[13px] font-semibold">{icon}{title}</h4>
        {note && <span className="text-[11.5px] text-ink-soft">{note}</span>}
      </header>
      {children}
    </section>
  );
}

export function AdsTab({ s, pid, brand, onGenerate, onUseTitle }: { s: State; pid: string; brand: string; onGenerate(): void; onUseTitle(plat: PlatId, title: string): void }) {
  const kit = s.ads[pid];
  const [intent, setIntent] = useState(0);
  useEffect(() => setIntent(0), [pid]);

  if (!kit)
    return (
      <div className="grid justify-items-start gap-3 rounded-2xl border border-dashed border-line p-5">
        <p className="text-[13.5px] leading-relaxed">
          Từ 24/09/2026, quảng cáo ChatGPT đã mở tại Việt Nam. Quảng cáo hiện thành thẻ tài trợ dưới câu trả lời và được chọn theo <b>ngữ cảnh cuộc hội thoại</b>, không theo từ khóa.
        </p>
        <p className="text-[13px] text-ink-soft">
          Agent dùng dữ liệu gốc đã có nguồn để viết: câu người mua sẽ hỏi, thẻ quảng cáo, từ khóa tìm kiếm trên sàn, tiêu đề SEO và bộ dữ kiện để trợ lý AI trích dẫn. Mọi câu đều qua Sổ luật.
        </p>
        <button type="button" onClick={onGenerate} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white hover:brightness-110">
          <Sparkles size={15} /> Tạo bộ quảng cáo
        </button>
      </div>
    );

  if (kit === "loading")
    return (
      <div className="grid gap-3">
        <p className="inline-flex items-center gap-2 text-[13px] text-brand"><Loader2 size={14} className="animate-spin" /> Agent đang viết bộ quảng cáo từ dữ liệu gốc…</p>
        {[0, 1, 2].map((i) => <div key={i} className="shimmer h-20 rounded-xl" />)}
      </div>
    );

  const k: AdsKit = kit;
  return (
    <div className="grid gap-6">
      <Section icon={<MessageSquareText size={14} />} title="Người mua hỏi, thẻ tài trợ hiện ra" note="Minh họa">
        <div className="grid gap-3 rounded-2xl bg-surface-2/60 p-3.5">
          <AnimatePresence mode="wait">
            <motion.p key={intent} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-[88%] justify-self-end rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-[13px] text-white">
              {k.intents[intent]}
            </motion.p>
          </AnimatePresence>
          <div className="grid gap-1.5" aria-hidden="true">
            <div className="h-2 w-11/12 rounded bg-line/80" />
            <div className="h-2 w-4/5 rounded bg-line/80" />
            <div className="h-2 w-2/3 rounded bg-line/80" />
          </div>
          <motion.div key={"ad" + intent} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid gap-2 rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2 text-[11px] text-ink-soft">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-brand/10 font-display text-[11px] font-bold text-brand">{brand.slice(0, 2).toUpperCase()}</span>
              <span className="font-medium text-ink">{brand}</span>
              <span className="ml-auto rounded bg-surface-2 px-1.5 py-px">Được tài trợ</span>
            </div>
            <b className="text-[14px] leading-snug">{k.ad.headline}</b>
            <p className="text-[12.5px] text-ink-soft">{k.ad.description}</p>
            <span className="inline-flex items-center gap-1 justify-self-start rounded-lg bg-ink px-2.5 py-1 text-[12px] font-semibold text-white">{k.ad.cta} <ArrowRight size={12} /></span>
          </motion.div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {k.intents.map((t, i) => (
            <button key={i} type="button" onClick={() => setIntent(i)} className={`max-w-full truncate rounded-full border px-2.5 py-1 text-left text-[12px] transition-colors ${i === intent ? "border-brand bg-brand/[0.06] text-brand" : "border-line hover:border-brand"}`} title={t}>
              {t}
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-ink-soft">
          Headline {k.ad.headline.length}/40 · mô tả {k.ad.description.length}/110 ký tự (giới hạn tự đặt). OpenAI cho biết quảng cáo không ảnh hưởng câu trả lời của ChatGPT.
        </p>
      </Section>

      <Section icon={<Search size={14} />} title="Từ khóa tìm kiếm trên sàn" note="Cho quảng cáo tìm kiếm Shopee, TikTok Shop">
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {k.keywords.map((w) => (
            <li key={w.keyword} className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-0.5 rounded-lg px-1 py-1">
              <b className="text-[13px] font-medium">{w.keyword}</b>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${INTENT_UI[w.intent] ?? INTENT_UI["tìm hiểu"]}`}>{w.intent}</span>
              <span className="col-span-2 text-[12px] text-ink-soft">{w.note}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={<Sparkles size={14} />} title="Tiêu đề chuẩn SEO" note="Đưa từ khóa chính lên đầu">
        <div className="grid gap-2">
          {PLATFORMS.map((pl) => {
            const t = k.seoTitles.find((x) => x.plat === pl.id)?.title;
            const cur = s.items[keyOf(pl.id, pid)]?.title;
            if (!t) return null;
            const same = t === cur;
            return (
              <div key={pl.id} className="grid gap-1.5 rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2 text-[11.5px] text-ink-soft">
                  <span className="font-semibold uppercase tracking-[0.08em]">{PNAME[pl.id]}</span>
                  <span className="font-mono">{t.length} ký tự</span>
                </div>
                {!same && cur && <p className="font-mono text-[11.5px] text-ink-soft line-through decoration-ink-soft/40">{cur}</p>}
                <p className="text-[13px] font-medium">{t}</p>
                <button type="button" disabled={same} onClick={() => onUseTitle(pl.id, t)} className="inline-flex items-center gap-1.5 justify-self-start rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold hover:border-brand disabled:border-ok/40 disabled:text-ok">
                  {same ? <><Check size={12} /> Đang dùng</> : "Dùng tiêu đề này"}
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      <Section icon={<ShieldCheck size={14} />} title="Dữ kiện cho trợ lý AI trích dẫn" note="GEO: tối ưu để được AI gợi ý">
        <dl className="m-0 grid gap-2">
          {k.facts.map((f, i) => (
            <div key={i} className="rounded-xl bg-surface-2/60 p-3">
              <dt className="text-[12.5px] font-semibold">{f.q}</dt>
              <dd className="m-0 text-[12.5px] text-ink-soft">
                {f.a} <span className="ml-1 rounded bg-brand/10 px-1.5 py-px font-mono text-[10.5px] text-brand">{f.source}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {k.softened.length > 0 && (
        <Section icon={<ShieldCheck size={14} />} title="Câu đã viết lại cho an toàn">
          <ul className="m-0 grid list-none gap-2 p-0">
            {k.softened.map((x, i) => (
              <li key={i} className="grid gap-1 rounded-lg bg-surface-2/60 p-2.5 font-mono text-[12px]">
                <span className="text-bad line-through decoration-bad/50">− {x.original}</span>
                <span className="text-ok">+ {x.replacement}</span>
                <span className="font-ui text-[11px] text-ink-soft">theo {x.ruleId}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <button type="button" onClick={onGenerate} className="inline-flex items-center gap-1.5 justify-self-start text-[12.5px] text-ink-soft underline-offset-2 hover:text-ink hover:underline">
        <RefreshCw size={13} /> Viết lại bộ quảng cáo
      </button>
    </div>
  );
}

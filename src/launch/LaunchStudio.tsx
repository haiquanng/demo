import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, ArrowRight, BookOpen, Check, CircleDot, Download, FileSpreadsheet, FileText, GitMerge, ImageIcon, Keyboard, Loader2, Radio, RotateCcw, Sparkles, Timer, Upload, X,
} from "lucide-react";
import { PLATFORMS, type Issue, type PlatId, type Product } from "../../api/_specs";
import { BorderBeam } from "@/components/ui/border-beam";
import { DotPattern } from "@/components/ui/dot-pattern";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdsTab } from "./AdsTab";
import BlurText from "@/components/BlurText";
import { PNAME, SAMPLE_FILES, SAMPLE_NOTICE, itemStatus, keyOf, readFile, useLaunch, type InFile, type LItem, type State } from "./useLaunch";

const HUES = [34, 150, 96, 48, 352, 14, 200, 270];
const hueOf = (pid: string) => HUES[(parseInt(pid.replace(/\D/g, ""), 10) - 1) % HUES.length] ?? 210;
const initials = (name: string) =>
  name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const secs = (ms: number) => (ms / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/* ---------- small pieces ---------- */

function Marked({ text, issues }: { text: string; issues: Issue[] }) {
  const marks = issues.filter((i) => i.phrase && text.includes(i.phrase));
  if (!marks.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest) {
    let best: { at: number; iss: Issue } | null = null;
    for (const iss of marks) {
      const at = rest.indexOf(iss.phrase!);
      if (at >= 0 && (!best || at < best.at)) best = { at, iss };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    out.push(rest.slice(0, best.at));
    out.push(
      <mark key={k++} className={`rounded px-0.5 ${best.iss.severity === "bad" ? "bg-bad/15 decoration-bad" : "bg-warn/15 decoration-warn"} underline decoration-wavy underline-offset-4 text-inherit`}>
        {best.iss.phrase}
      </mark>,
    );
    rest = rest.slice(best.at + best.iss.phrase!.length);
  }
  return <>{out}</>;
}

function Tile({ pid, name, className = "" }: { pid: string; name: string; className?: string }) {
  const h = hueOf(pid);
  return (
    <div
      className={`grid place-items-center font-display font-bold ${className}`}
      style={{ background: `linear-gradient(145deg, hsl(${h} 70% 86%), hsl(${h} 55% 66%))`, color: `hsl(${h} 45% 22%)` }}
    >
      {initials(name)}
    </div>
  );
}

const STATUS_UI = {
  bad: { label: "Vi phạm", cls: "text-bad", ring: "border-bad/45 bg-bad/[0.04]", dot: "bg-bad" },
  warn: { label: "Cần xem", cls: "text-warn", ring: "border-warn/45 bg-warn/[0.05]", dot: "bg-warn" },
  clean: { label: "Sạch, chờ merge", cls: "text-ok", ring: "border-line bg-surface", dot: "bg-ok" },
  merged: { label: "Đã merge", cls: "text-live", ring: "border-live/40 bg-live/[0.05]", dot: "bg-live" },
} as const;

function Pill({ st }: { st: keyof typeof STATUS_UI }) {
  const u = STATUS_UI[st];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-[11.5px] font-semibold ${u.cls} shadow-[0_0_0_1px_var(--color-line)]`}>
      {st === "merged" ? <GitMerge size={12} /> : <span className={`h-1.5 w-1.5 rounded-full ${u.dot}`} />}
      {u.label}
    </span>
  );
}

function SrcChip({ source }: { source: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="ml-1 inline-block cursor-help rounded bg-brand/10 px-1.5 py-px font-mono text-[10.5px] text-brand">{source}</span>
      </TooltipTrigger>
      <TooltipContent>Agent lấy thông tin này từ {source} trong tài liệu brand gửi</TooltipContent>
    </Tooltip>
  );
}

/* ---------- idle: drop zone ---------- */

function DropZone({ onFiles, onSample, onCache }: { onFiles(f: InFile[]): void; onSample(): void; onCache(): void }) {
  const [picked, setPicked] = useState<InFile[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    const read = await Promise.all([...list].map(readFile));
    setPicked((p) => [...p, ...read]);
    setBusy(false);
  };
  const total = picked.reduce((a, f) => a + f.size, 0);
  const tooBig = total > 4 * 1024 * 1024;
  const icon = (f: { name: string; mime: string }) =>
    f.mime.startsWith("image/") ? <ImageIcon size={16} /> : /csv|sheet|xls/i.test(f.name) ? <FileSpreadsheet size={16} /> : <FileText size={16} />;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}
        className={`relative isolate grid gap-5 overflow-hidden rounded-2xl border-2 border-dashed p-6 transition-colors sm:p-8 ${over ? "border-brand bg-brand/[0.05]" : "border-line bg-surface"}`}
      >
        <DotPattern width={18} height={18} cr={1} className="-z-10 text-line [mask-image:radial-gradient(420px_circle_at_85%_20%,white,transparent)]" />
        <div className="grid gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">Brand mới vừa ký</span>
          <h2 className="m-0 max-w-[22ch] font-display text-[32px] leading-[1.1]">
            <BlurText text="Thả catalog vào. Ba agent đưa hàng lên ba sàn." animateBy="words" delay={60} className="flex-wrap" />
          </h2>
          <p className="max-w-[58ch] text-[14.5px] text-ink-soft">
            PDF, ảnh, Excel hoặc CSV, lộn xộn cũng được. Agent đọc và ghép thành dữ liệu gốc, mỗi sàn một agent dựng listing theo đúng luật của sàn đó, rồi chờ bạn duyệt như review một pull request.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <ShimmerButton onClick={onSample} background="var(--color-brand)" borderRadius="12px" shimmerColor="#dfe6ff" className="gap-2 px-4 py-2.5 text-[14px] font-semibold">
            <Sparkles size={16} /> Dùng catalog mẫu Hạ Vy
          </ShimmerButton>
          <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 font-semibold transition hover:border-brand">
            <Upload size={16} /> Chọn file của bạn
          </button>
          <input ref={input} type="file" multiple hidden accept=".pdf,.csv,.txt,.xlsx,.xls,image/*" onChange={(e) => void add(e.target.files)} />
        </div>
        {(picked.length > 0 || busy) && (
          <div className="grid gap-2">
            {picked.map((f, i) => (
              <div key={f.name + i} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[13px]">
                <span className="text-ink-soft">{icon(f)}</span>
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="font-mono text-[11.5px] text-ink-soft">{(f.size / 1024).toFixed(0)} KB</span>
                <button type="button" aria-label={`Bỏ ${f.name}`} onClick={() => setPicked((p) => p.filter((_, j) => j !== i))} className="rounded p-0.5 text-ink-soft hover:text-bad">
                  <X size={14} />
                </button>
              </div>
            ))}
            {busy && <p className="text-[13px] text-ink-soft">Đang đọc file…</p>}
            {tooBig && <p className="text-[13px] text-bad">Tổng dung lượng vượt 4 MB. Bỏ bớt file hoặc dùng bản nén.</p>}
            <button type="button" disabled={!picked.length || tooBig} onClick={() => onFiles(picked)} className="inline-flex items-center justify-self-start gap-2 rounded-xl bg-ink px-4 py-2.5 font-semibold text-white disabled:opacity-40">
              Bắt đầu với {picked.length} file <ArrowRight size={16} />
            </button>
          </div>
        )}
        <p className="text-[12.5px] text-ink-soft">
          File mẫu:{" "}
          {SAMPLE_FILES.map((f, i) => (
            <span key={f.url}>
              {i > 0 && " · "}
              <a className="text-brand underline underline-offset-2" href={f.url} target="_blank" rel="noreferrer">{f.name}</a>
            </span>
          ))}
          {" · "}
          <button type="button" onClick={onCache} className="text-ink-soft underline underline-offset-2 hover:text-ink">Chạy bản ghi sẵn (không gọi AI)</button>
        </p>
      </motion.div>

      <motion.ol initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="m-0 grid list-none content-start gap-3 rounded-2xl bg-ink p-6 text-white sm:p-7">
        <li className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">Chuyện gì xảy ra sau khi thả file</li>
        {[
          ["Đọc và ghép", "Ghép “SRM trà xanh” trong bảng giá với “Sữa rửa mặt Trà xanh” trong PDF. Báo chỗ hai nguồn lệch nhau."],
          ["Ba agent chạy song song", "Mỗi sàn một agent: chọn danh mục trong cây của sàn, điền thuộc tính bắt buộc, viết tiêu đề theo quy ước."],
          ["Soát theo Sổ luật", "Gạch chân câu có nguy cơ bị đình chỉ, nêu lý do, đề xuất câu thay thế. Mọi nhận định đều ghi nguồn."],
          ["Bạn review rồi merge", "Duyệt từng listing như review code. Sàn từ chối thì agent học luật mới và quét lại mọi listing."],
        ].map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[28px_1fr] gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 font-mono text-[12px]">{i + 1}</span>
            <div>
              <b className="font-semibold">{t}</b>
              <p className="text-[13px] text-white/70">{d}</p>
            </div>
          </li>
        ))}
      </motion.ol>
    </div>
  );
}

/* ---------- stage bar ---------- */

function Num({ v }: { v: number }) {
  return v ? <NumberTicker value={v} className="font-mono font-semibold text-ink tabular-nums" /> : <span className="font-mono font-semibold text-ink">0</span>;
}

function StageBar({ s, onReset, onRules }: { s: State; onReset(): void; onRules(): void }) {
  const [now, setNow] = useState(Date.now());
  const running = s.phase === "reading" || s.phase === "building";
  useEffect(() => {
    if (!running) return;
    const h = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(h);
  }, [running]);
  const items = Object.values(s.items);
  const merged = items.filter((l) => l.merged).length;
  const open = items.filter((l) => l.issues.length).length;
  const stages = [
    { key: "reading", label: "Đọc catalog", done: s.phase !== "reading" },
    { key: "building", label: "3 agent dựng listing", done: s.phase === "review" },
    { key: "review", label: "Review & merge", done: items.length > 0 && merged === items.length },
  ];
  const elapsed = s.totalMs ?? (s.startedAt ? now - s.startedAt : 0);
  return (
    <div className="sticky top-[calc(env(safe-area-inset-top,0px)+8px)] z-20 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-surface/90 px-4 py-3 shadow-[0_6px_24px_rgba(21,32,43,0.07)] backdrop-blur">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
        {stages.map((st, i) => {
          const active = s.phase === st.key;
          return (
            <li key={st.key} className="flex items-center gap-1.5">
              {i > 0 && <span className="h-px w-4 bg-line" />}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium ${active ? "bg-brand text-white" : st.done ? "bg-ok/10 text-ok" : "bg-surface-2 text-ink-soft"}`}>
                {active && st.key !== "review" ? <Loader2 size={13} className="animate-spin" /> : st.done ? <Check size={13} /> : <CircleDot size={13} />}
                {st.label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-ink-soft">
        <span className="inline-flex items-center gap-1.5 font-mono text-ink"><Timer size={14} className="text-ink-soft" />{secs(elapsed)} giây</span>
        <span><Num v={s.products.length} /> sản phẩm</span>
        <span><Num v={items.length} />/{s.products.length * 3 || 18} listing</span>
        {s.phase === "review" && <span className={open ? "text-bad" : "text-ok"}><Num v={open} /> cần xử lý</span>}
        {s.phase === "review" && <span><Num v={merged} /> đã merge</span>}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${s.source === "live" ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"}`}>
          <Radio size={12} />
          {s.source === "live" ? `Live · ${s.model ?? "Gemini"}` : "Bản ghi sẵn"}
        </span>
        <button type="button" onClick={onRules} className="relative inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[12.5px] hover:border-brand">
          <BookOpen size={13} /> Sổ luật <span className="font-mono text-ink-soft">{s.rules.length}</span>
          {s.newRules.length > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand" />}
        </button>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[12.5px] hover:border-brand">
          <RotateCcw size={13} /> Catalog khác
        </button>
      </div>
    </div>
  );
}

/* ---------- master data ---------- */

const READ_LINES = ["Đọc PDF và bảng giá", "Ghép tên viết tắt giữa các nguồn", "Tìm chỗ hai nguồn lệch nhau", "Chép lại câu quảng cáo có rủi ro", "Ghi nguồn cho từng thông tin"];

function MasterStrip({ s }: { s: State }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (s.phase !== "reading") return;
    setLine(0);
    const h = setInterval(() => setLine((x) => Math.min(READ_LINES.length - 1, x + 1)), 1500);
    return () => clearInterval(h);
  }, [s.phase]);
  return (
    <section className="grid min-w-0 gap-2.5" aria-label="Dữ liệu gốc">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink-soft">
        <span className="font-semibold uppercase tracking-[0.08em]">Dữ liệu gốc</span>
        {s.files.map((f) => (
          <span key={f.name} className="inline-flex min-w-0 max-w-[260px] items-center gap-1">
            {/csv|sheet|xls/i.test(f.name) ? <FileSpreadsheet size={12} className="shrink-0" /> : <FileText size={12} className="shrink-0" />}
            <span className="truncate">{f.name}</span>
          </span>
        ))}
      </div>
      {s.phase === "reading" ? (
        <ol className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
          {READ_LINES.map((t, i) => (
            <li key={t} className={`inline-flex items-center gap-1.5 text-[12.5px] ${i < line ? "text-ink" : i === line ? "font-medium text-brand" : "text-ink-soft/60"}`}>
              {i < line ? <Check size={13} className="text-ok" /> : i === line ? <Loader2 size={13} className="animate-spin" /> : <CircleDot size={13} />}
              {t}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1">
          <AnimatePresence>
            {s.products.map((p, i) => (
              <motion.li key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex shrink-0 items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 shadow-[0_0_0_1px_var(--color-line)]">
                <Tile pid={p.id} name={p.name} className="h-7 w-7 rounded-full text-[10.5px]" />
                <span className="max-w-[180px] truncate text-[12.5px] font-medium">{p.name}</span>
                <span className="font-mono text-[11px] text-ink-soft">{p.size}</span>
                {p.flags.map((f, j) => (
                  <Tooltip key={j}>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className={`h-2 w-2 cursor-help rounded-full ${f.kind === "conflict" ? "bg-warn" : f.kind === "risky" ? "bg-bad" : "bg-ink-soft/40"}`} aria-label={f.detail} />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px]">
                      <b>{f.kind === "conflict" ? "Nguồn lệch" : f.kind === "risky" ? "Câu rủi ro" : "Thiếu"} · {f.field}.</b> {f.detail}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

/* ---------- lanes ---------- */

function PhoneCard({ l, product, selected, onSelect }: { l: LItem; product?: Product; selected: boolean; onSelect(): void }) {
  const st = itemStatus(l);
  const u = STATUS_UI[st];
  return (
    <motion.button
      layout
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`group w-full rounded-[18px] border p-1.5 text-left transition-shadow ${u.ring} ${selected ? "shadow-[0_0_0_2px_var(--color-brand)]" : "hover:shadow-[0_0_0_1px_var(--color-brand)]"}`}
      aria-label={`${product?.name ?? l.productId} trên ${PNAME[l.plat]}: ${u.label}`}
    >
      <div className="overflow-hidden rounded-[13px] bg-surface">
        <div className="relative">
          <Tile pid={l.productId} name={product?.name ?? l.productId} className="h-14 w-full justify-items-start pl-3 text-[18px]" />
          <span className="absolute right-1.5 top-1.5"><Pill st={st} /></span>
          {l.reopened && <span className="absolute left-1.5 top-1.5 rounded-full bg-bad px-1.5 py-0.5 text-[10px] font-bold text-white">Mở lại</span>}
        </div>
        <div className="grid gap-1 p-2.5">
          <p className="line-clamp-2 text-[12.5px] leading-snug font-medium"><Marked text={l.title} issues={l.issues} /></p>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[12.5px] font-semibold">{vnd(l.price)}</span>
            {l.issues.length > 0 && <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${u.cls}`}><AlertTriangle size={11} />{l.issues.length}</span>}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function SkeletonCard({ dim }: { dim: boolean }) {
  return (
    <div className={`rounded-[18px] border border-line bg-surface p-1.5 ${dim ? "opacity-50" : ""}`} aria-hidden="true">
      <div className="overflow-hidden rounded-[13px]">
        <div className="shimmer h-14" />
        <div className="grid gap-2 p-2.5">
          <div className="shimmer h-2.5 w-5/6 rounded" />
          <div className="shimmer h-2.5 w-3/5 rounded" />
          <div className="shimmer mt-1 h-2.5 w-1/3 rounded" />
        </div>
      </div>
    </div>
  );
}

function Lanes({ s, select }: { s: State; select(k: string): void }) {
  return (
    <div className="grid min-w-0 gap-5 md:grid-cols-3">
      {PLATFORMS.map((pl) => {
        const ag = s.agents[pl.id];
        const keys = s.order[pl.id];
        const waiting = s.phase === "building" || s.phase === "reading" ? Math.max(0, (s.products.length || 6) - keys.length) : 0;
        return (
          <section key={pl.id} className="relative grid min-w-0 content-start gap-3 rounded-2xl p-1" aria-label={`Làn ${pl.name}`}>
            {ag.status === "running" && <BorderBeam size={120} duration={4} colorFrom="#2b4fc4" colorTo="#7fb0ff" borderWidth={2} />}
            <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-b border-line px-1 pb-2">
              <h3 className="m-0 whitespace-nowrap font-display text-[15px]">{pl.name}</h3>
              <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-soft">
                {ag.status === "running" ? (
                  <><Loader2 size={12} className="animate-spin text-brand" /> Agent đang dựng {keys.length}/{s.products.length}</>
                ) : ag.status === "done" ? (
                  <><Check size={12} className="text-ok" /> {keys.length} listing · {secs(ag.ms ?? 0)} giây</>
                ) : (
                  <>Chờ dữ liệu gốc</>
                )}
              </span>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 2xl:grid-cols-2">
              {keys.map((k) => (
                <PhoneCard key={k} l={s.items[k]} product={s.products.find((p) => p.id === s.items[k].productId)} selected={s.selected === k} onSelect={() => select(k)} />
              ))}
              {s.phase === "reading" && <p className="px-1.5 text-[12px] text-ink-soft">Agent của {pl.name} bắt đầu ngay khi đọc xong catalog.</p>}
              {Array.from({ length: s.phase === "reading" ? 2 : waiting }).map((_, i) => (
                <SkeletonCard key={"sk" + i} dim={s.phase === "reading"} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------- decision panel ---------- */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{label}</span>
      <div className="text-[13.5px] leading-relaxed">{children}</div>
    </div>
  );
}

function DecisionBody({ s, dispatch }: { s: State; dispatch: ReturnType<typeof useLaunch>["dispatch"] }) {
  const l = s.selected ? s.items[s.selected] : null;
  const [lastRule, setLastRule] = useState<string | null>(null);
  useEffect(() => setLastRule(null), [s.selected]);
  if (!l) return null;
  const p = s.products.find((x) => x.id === l.productId);
  const siblings = lastRule
    ? PLATFORMS.filter((pl) => pl.id !== l.plat).filter((pl) => s.items[keyOf(pl.id, l.productId)]?.issues.some((i) => i.ruleId === lastRule)).length
    : 0;
  const descIssues = l.issues.filter((i) => i.field === "description");

  return (
    <div className="grid content-start gap-5">

      <div className="mx-auto w-full max-w-[300px] rounded-[26px] border border-line bg-ink/[0.03] p-2 shadow-sm">
        <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
          <div className="flex items-center justify-between px-3 pt-1.5 text-[10px] text-ink-soft"><span>Khách sẽ thấy</span><span>{PNAME[l.plat]}</span></div>
          <Tile pid={l.productId} name={p?.name ?? ""} className="mt-1.5 h-24 w-full text-[26px]" />
          <div className="grid gap-1.5 p-3">
            <p className="text-[13.5px] leading-snug font-medium"><Marked text={l.title} issues={l.issues} /></p>
            <span className="font-mono text-[15px] font-semibold text-bad">{vnd(l.price)}</span>
            <p className="text-[11px] text-ink-soft">{l.categoryPath.join(" › ")}{l.categoryConfidence < 0.8 && <b className="text-warn"> · tin cậy {Math.round(l.categoryConfidence * 100)}%</b>}</p>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-line pt-1.5 text-[11.5px]">
              {l.attributes.map((a, i) => (
                <div key={a.key + i} className="contents">
                  <dt className="text-ink-soft">{a.key}</dt>
                  <dd className={`m-0 ${a.value === null ? "font-semibold text-warn" : a.inferred ? "underline decoration-dotted decoration-warn underline-offset-2" : ""}`} title={a.inferred ? `Agent suy ra · ${a.source}` : a.source}>
                    {a.value ?? "Chưa có"}
                  </dd>
                </div>
              ))}
            </dl>
            {l.description.length > 0 && (
              <div className="border-t border-line pt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
                {l.description.map((d, i) => <p key={i}><Marked text={d} issues={descIssues} /></p>)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl bg-surface-2/70 p-3">
        <Row label="Quyết định">{l.decision.summary}</Row>
        <Row label="Bằng chứng">
          <ul className="m-0 grid list-none gap-1 p-0">
            {l.decision.evidence.map((e, i) => (
              <li key={i}>“{e.text}”<SrcChip source={e.source} /></li>
            ))}
          </ul>
        </Row>
        <Row label="Đánh đổi">{l.decision.tradeoff}</Row>
        <Row label="Bước tiếp theo">{l.decision.next}</Row>
      </div>

      <div className="grid gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-soft">Vấn đề cần xử lý ({l.issues.length})</span>
        <AnimatePresence initial={false}>
          {l.issues.map((iss, i) => (
            <motion.div
              key={iss.ruleId + (iss.phrase ?? "") + i}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`grid gap-2 rounded-xl border border-l-4 p-3 ${iss.severity === "bad" ? "border-line border-l-bad" : "border-line border-l-warn"}`}
            >
              <div className="flex items-center gap-2 text-[12px]">
                <span className="font-mono font-semibold">{iss.ruleId}</span>
                <b className={iss.severity === "bad" ? "text-bad" : "text-warn"}>{iss.severity === "bad" ? "Vi phạm" : "Cần xác nhận"}</b>
                <span className="text-ink-soft">· {iss.field === "title" ? "tiêu đề" : iss.field === "description" ? "mô tả" : iss.field === "category" ? "danh mục" : "thuộc tính"}</span>
              </div>
              <p className="text-[13px]">{iss.reason}</p>
              {(iss.fix.from || iss.phrase) && (
                <div className="grid gap-1 rounded-lg bg-surface-2/70 p-2 font-mono text-[12px]">
                  <span className="text-bad line-through decoration-bad/60">− {iss.fix.from ?? iss.phrase}</span>
                  <span className="text-ok">+ {iss.fix.to}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => { setLastRule(iss.ruleId); dispatch({ t: "fix", key: l.key, index: i }); }}
                className="inline-flex items-center gap-1.5 justify-self-start rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:brightness-125"
              >
                <Check size={13} /> {iss.fix.label || "Áp dụng"}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {!l.issues.length && <p className="text-[13px] text-ok">Không còn vấn đề nào theo {s.rules.length} luật hiện có.</p>}
      </div>

      <AnimatePresence>
        {siblings > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            type="button"
            onClick={() => { dispatch({ t: "fixSiblings", key: l.key, ruleId: lastRule! }); setLastRule(null); }}
            className="rounded-xl border border-brand/40 bg-brand/[0.06] px-3 py-2 text-left text-[13px] font-medium text-brand"
          >
            Áp dụng sửa tương tự cho {siblings} sàn còn lại của sản phẩm này
          </motion.button>
        )}
        {s.pendingRule?.key === l.key && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-2 rounded-xl border border-brand/40 bg-brand/[0.06] p-3">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand"><BookOpen size={14} /> Ghi thành luật cho lần sau?</span>
            <p className="text-[13px]">{s.pendingRule.text}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => dispatch({ t: "rule", accept: true })} className="rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white">Ghi vào Sổ luật</button>
              <button type="button" onClick={() => dispatch({ t: "rule", accept: false })} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px]">Bỏ qua</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky bottom-0 -mx-5 -mb-5 grid gap-2 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <button
          type="button"
          disabled={l.issues.length > 0 || l.merged}
          onClick={() => dispatch({ t: "merge", key: l.key })}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white transition disabled:bg-surface-2 disabled:text-ink-soft"
        >
          <GitMerge size={16} />
          {l.merged ? `Đã merge lên ${PNAME[l.plat]}` : l.issues.length ? `Còn ${l.issues.length} vấn đề trước khi merge` : `Merge lên ${PNAME[l.plat]}`}
        </button>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-soft">
          <Keyboard size={12} /> <Kbd>J</Kbd><Kbd>K</Kbd> chuyển · <Kbd>F</Kbd> áp dụng sửa · <Kbd>A</Kbd> merge
        </span>
      </div>
    </div>
  );
}

/* ---------- feedback + rules ---------- */

function LearnBox({ s, learn, select }: { s: State; learn(n: string): void; select(k: string): void }) {
  const [text, setText] = useState(SAMPLE_NOTICE);
  const affected = Object.values(s.items).filter((l) => l.issues.some((i) => s.newRules.includes(i.ruleId) && s.lastLearned));
  return (
    <section className="grid content-start gap-3" aria-label="Phản hồi từ sàn">
      <h3 className="m-0 font-display text-[16px]">Phản hồi từ sàn</h3>
      <label htmlFor="notice" className="text-[12.5px] text-ink-soft">Dán nguyên văn thông báo. Agent rút ra luật mới và quét lại mọi listing.</label>
      <textarea id="notice" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[92px] w-full resize-y rounded-xl border border-line bg-surface-2/60 p-3 text-[13px] leading-relaxed outline-none focus:border-brand" />
      <button type="button" disabled={s.learning || s.phase !== "review" || !text.trim()} onClick={() => learn(text)} className="inline-flex items-center justify-self-start gap-2 rounded-xl bg-ink px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-40">
        {s.learning ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Cho agent đọc
      </button>
      <AnimatePresence>
        {s.lastLearned && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-2 rounded-xl bg-surface-2/70 p-3 text-[13px]">
            <p>{s.lastLearned.explanation}</p>
            <p className="font-semibold text-bad">{affected.length} listing bị ảnh hưởng, đã soạn sẵn bản sửa:</p>
            <div className="flex flex-wrap gap-1.5">
              {affected.map((l) => (
                <button key={l.key} type="button" onClick={() => select(l.key)} className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px] hover:border-brand">
                  {s.products.find((p) => p.id === l.productId)?.name} · {PNAME[l.plat]}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function RuleBook({ s }: { s: State }) {
  return (
    <section className="grid content-start gap-3" aria-label="Sổ luật">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 font-display text-[16px]">Sổ luật</h3>
        <span className="text-[12px] text-ink-soft">{s.rules.length} luật · luật nền là mẫu để minh họa</span>
      </header>
      <ul className="m-0 grid list-none gap-2 p-0">
        <AnimatePresence initial={false}>
          {[...s.rules].reverse().map((r) => {
            const isNew = s.newRules.includes(r.id);
            return (
              <motion.li key={r.id} layout initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`grid gap-1 rounded-xl border p-3 ${isNew ? "border-brand/50 bg-brand/[0.05]" : "border-line"}`}>
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                  <span className="font-mono font-semibold">{r.id}</span>
                  <span className="rounded bg-surface-2 px-1.5 py-px text-ink-soft">{r.plat === "all" ? "Cả 3 sàn" : PNAME[r.plat]}</span>
                  {isNew && <span className="font-semibold uppercase tracking-[0.06em] text-brand">Mới học</span>}
                </div>
                <p className="text-[13px]">{r.text}</p>
                <span className="text-[11.5px] text-ink-soft">{r.source}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}

/* ---------- page ---------- */

export default function LaunchStudio() {
  const { s, dispatch, start, startSample, startCache, learn, genAds, exportXlsx } = useLaunch();
  const [panel, setPanel] = useState<null | "listing" | "rules">(null);
  const [tab, setTab] = useState("decision");
  const select = (k: string) => {
    dispatch({ t: "select", key: k });
    setPanel("listing");
  };
  const flat = useMemo(() => PLATFORMS.flatMap((p) => s.order[p.id]), [s.order]);
  const items = Object.values(s.items);
  const merged = items.filter((l) => l.merged).length;
  const cleanOpen = items.filter((l) => !l.issues.length && !l.merged).length;
  const cur = s.selected ? s.items[s.selected] : null;
  const curProduct = cur ? s.products.find((p) => p.id === cur.productId) : null;

  // ?autostart=live chạy catalog mẫu với Gemini thật, ?autostart=cache chạy bản ghi sẵn. Tiện khi thuyết trình.
  useEffect(() => {
    const mode = new URLSearchParams(location.search).get("autostart");
    if (mode === "live") void startSample();
    if (mode === "cache") void startCache();
    // chỉ chạy một lần khi mở trang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (s.phase !== "review") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || e.metaKey || e.ctrlKey) return;
      const i = s.selected ? flat.indexOf(s.selected) : -1;
      if (e.key === "j") select(flat[Math.min(flat.length - 1, i + 1)]);
      if (e.key === "k") select(flat[Math.max(0, i - 1)]);
      if (panel !== "listing" || !s.selected) return;
      if (e.key === "a") dispatch({ t: "merge", key: s.selected });
      if (e.key === "f" && s.items[s.selected]?.issues.length) dispatch({ t: "fix", key: s.selected, index: 0 });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  return (
    <div className="grid gap-5 pb-24">
      {s.phase === "idle" ? (
        <DropZone onFiles={(f) => void start(f)} onSample={() => void startSample()} onCache={() => void startCache()} />
      ) : (
        <>
          <StageBar s={s} onReset={() => { setPanel(null); dispatch({ t: "reset" }); }} onRules={() => setPanel("rules")} />
          <MasterStrip s={s} />
          <Lanes s={s} select={select} />
          {s.phase === "review" && (
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
              <div className="mx-auto flex max-w-[980px] flex-wrap items-center gap-3 rounded-2xl border border-line bg-ink px-4 py-3 text-white shadow-2xl">
                <div className="grid min-w-[180px] flex-1 gap-1">
                  <span className="text-[12.5px]">Đã merge <b className="font-mono">{merged}/{items.length}</b> listing</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                    <motion.div className="h-full rounded-full bg-ok" animate={{ width: `${items.length ? (merged / items.length) * 100 : 0}%` }} />
                  </div>
                </div>
                <button type="button" onClick={() => setPanel("rules")} className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-[13px] font-semibold">
                  <Sparkles size={14} /> Dán phản hồi từ sàn
                </button>
                <button type="button" disabled={!cleanOpen} onClick={() => dispatch({ t: "mergeClean" })} className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-[13px] font-semibold disabled:opacity-40">
                  <GitMerge size={14} /> Merge listing sạch ({cleanOpen})
                </button>
                <button type="button" disabled={!merged} onClick={exportXlsx} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-ink disabled:opacity-40">
                  <Download size={14} /> Xuất file đăng hàng loạt
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}

      <Sheet open={panel === "listing" && !!cur} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-[560px]">
          {cur && curProduct && (
            <>
              <div className="sticky top-0 z-10 grid gap-3 border-b border-line bg-surface/95 px-5 pb-0 pt-5 backdrop-blur">
                <div className="flex items-start gap-3 pr-8">
                  <Tile pid={cur.productId} name={curProduct.name} className="h-11 w-11 shrink-0 rounded-xl text-[14px]" />
                  <div className="min-w-0 flex-1">
                    <SheetDescription className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft">{PNAME[cur.plat]} · {cur.productId} · {flat.indexOf(cur.key) + 1}/{flat.length}</SheetDescription>
                    <SheetTitle className="font-display text-[20px] leading-tight">{curProduct.name}</SheetTitle>
                  </div>
                  <Pill st={itemStatus(cur)} />
                </div>
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList variant="line" className="h-9">
                    <TabsTrigger value="decision">Quyết định{cur.issues.length ? ` · ${cur.issues.length}` : ""}</TabsTrigger>
                    <TabsTrigger value="ads">Quảng cáo &amp; AI Search</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="p-5">
                <Tabs value={tab}>
                  <TabsContent value="decision"><DecisionBody s={s} dispatch={dispatch} /></TabsContent>
                  <TabsContent value="ads">
                    <AdsTab
                      s={s}
                      pid={cur.productId}
                      brand={curProduct.brand || "Brand"}
                      onGenerate={() => void genAds(cur.productId)}
                      onUseTitle={(plat, title) => dispatch({ t: "setTitle", key: keyOf(plat, cur.productId), title })}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={panel === "rules"} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="right" className="w-full gap-6 overflow-y-auto p-5 data-[side=right]:sm:max-w-[520px]">
          <div className="pr-8">
            <SheetTitle className="font-display text-[20px]">Sổ luật &amp; phản hồi từ sàn</SheetTitle>
            <SheetDescription className="text-[13px]">Agent học thêm luật mỗi khi sàn từ chối hoặc khi chuyên viên sửa một đề xuất.</SheetDescription>
          </div>
          <LearnBox s={s} learn={(n) => void learn(n)} select={select} />
          <RuleBook s={s} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

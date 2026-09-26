import { useCallback, useReducer, useRef } from "react";
import * as XLSX from "xlsx";
import { toast as sonner } from "sonner";
import { PLATFORMS, RULES_BASE, type Issue, type Listing, type PlatId, type Product, type Rule } from "../../api/_specs";
import cacheLaunch from "../data/cache-launch.json";
import cacheLearn from "../data/cache-learn.json";
import cacheAds from "../data/cache-ads.json";
import type { AdsKit } from "../../api/ads";
export type { AdsKit };

export type Phase = "idle" | "reading" | "building" | "review";
export type Source = "live" | "cache";

export interface LItem extends Listing {
  key: string;
  plat: PlatId;
  description: string[];
  merged: boolean;
  reopened: boolean;
}
export interface InFile { name: string; mime: string; size: number; data?: string; text?: string }
export interface PendingRule { key: string; plat: PlatId | "all"; text: string }
export interface Toast { id: number; text: string; tone: "ok" | "warn" | "bad" | "info" }
export interface Learned {
  rule: { plat: PlatId | "all"; text: string };
  explanation: string;
  affected: { productId: string; field: "title" | "description"; phrase: string; replacement: string; label: string }[];
  notice?: string;
}

export interface State {
  phase: Phase;
  source: Source;
  model: string | null;
  files: { name: string; size: number; mime: string }[];
  products: Product[];
  items: Record<string, LItem>;
  order: Record<PlatId, string[]>;
  agents: Record<PlatId, { status: "idle" | "running" | "done"; ms?: number }>;
  startedAt: number | null;
  readMs: number | null;
  totalMs: number | null;
  rules: Rule[];
  newRules: string[];
  selected: string | null;
  pendingRule: PendingRule | null;
  toasts: Toast[];
  learning: boolean;
  lastLearned: Learned | null;
  ads: Record<string, AdsKit | "loading">;
}

const blank = (): State => ({
  phase: "idle",
  source: "live",
  model: null,
  files: [],
  products: [],
  items: {},
  order: { sp: [], tt: [], lz: [] },
  agents: { sp: { status: "idle" }, tt: { status: "idle" }, lz: { status: "idle" } },
  startedAt: null,
  readMs: null,
  totalMs: null,
  rules: RULES_BASE.map((r) => ({ ...r })),
  newRules: [],
  selected: null,
  pendingRule: null,
  toasts: [],
  learning: false,
  lastLearned: null,
  ads: {},
});

type Ev =
  | { type: "stage"; stage: "read" | "build" | "review"; ms?: number }
  | { type: "model"; model: string }
  | { type: "product"; product: Product }
  | { type: "agent"; plat: PlatId; status: "running" | "done"; ms?: number }
  | { type: "listing"; plat: PlatId; listing: Listing }
  | { type: "done"; ms: number }
  | { type: "error"; message: string };

type Act =
  | { t: "start"; files: State["files"]; source: Source }
  | { t: "ev"; ev: Ev }
  | { t: "select"; key: string | null }
  | { t: "fix"; key: string; index: number }
  | { t: "fixSiblings"; key: string; ruleId: string }
  | { t: "merge"; key: string }
  | { t: "mergeClean" }
  | { t: "rule"; accept: boolean }
  | { t: "learning"; on: boolean }
  | { t: "learned"; data: Learned }
  | { t: "toast"; text: string; tone: Toast["tone"] }
  | { t: "untoast"; id: number }
  | { t: "reset" }
  | { t: "ads"; pid: string; kit: AdsKit | "loading" | null }
  | { t: "setTitle"; key: string; title: string };

export const keyOf = (plat: PlatId, pid: string) => `${plat}:${pid}`;
export const PNAME = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.name])) as Record<PlatId, string>;
let toastId = 0;

export function itemStatus(l: LItem): "bad" | "warn" | "clean" | "merged" {
  if (l.issues.some((i) => i.severity === "bad")) return "bad";
  if (l.issues.length) return "warn";
  return l.merged ? "merged" : "clean";
}

function applyIssue(l: LItem, iss: Issue): LItem {
  const n: LItem = { ...l, attributes: l.attributes.map((a) => ({ ...a })), description: [...l.description] };
  const from = iss.fix.from ?? iss.phrase;
  if (iss.field === "title" && from && n.title.includes(from)) n.title = n.title.replace(from, iss.fix.to).replace(/\s{2,}/g, " ").trim();
  if (iss.field === "description" && from) n.description = n.description.map((d) => (d.includes(from) ? d.replace(from, iss.fix.to) : d));
  if (iss.field === "category") n.categoryConfidence = 1;
  if (iss.field === "attribute") {
    const byValue = n.attributes.find((a) => from && a.value === from);
    const target = byValue ?? n.attributes.find((a) => a.value === null || a.inferred) ?? n.attributes.find((a) => a.key === "Quy cách");
    if (target) {
      target.value = iss.fix.to;
      target.inferred = false;
    }
  }
  n.issues = n.issues.filter((x) => x !== iss);
  return n;
}

function reducer(s: State, a: Act): State {
  switch (a.t) {
    case "reset":
      return { ...blank(), rules: s.rules, newRules: s.newRules };
    case "start":
      return { ...blank(), rules: s.rules, newRules: s.newRules, phase: "reading", source: a.source, files: a.files, startedAt: Date.now() };
    case "ev": {
      const ev = a.ev;
      if (ev.type === "model") return { ...s, model: ev.model };
      if (ev.type === "product") return s.products.some((x) => x.id === ev.product.id) ? s : { ...s, products: [...s.products, ev.product] };
      if (ev.type === "stage" && ev.stage === "build") return { ...s, phase: "building", readMs: ev.ms ?? null };
      if (ev.type === "agent") return { ...s, agents: { ...s.agents, [ev.plat]: { status: ev.status, ms: ev.ms } } };
      if (ev.type === "listing") {
        const p = s.products.find((x) => x.id === ev.listing.productId);
        const key = keyOf(ev.plat, ev.listing.productId);
        const item: LItem = { ...ev.listing, key, plat: ev.plat, description: p?.claims.map((c) => c.text) ?? [], merged: false, reopened: false };
        const order = s.order[ev.plat].includes(key) ? s.order[ev.plat] : [...s.order[ev.plat], key];
        return { ...s, items: { ...s.items, [key]: item }, order: { ...s.order, [ev.plat]: order } };
      }
      if (ev.type === "done") {
        return { ...s, phase: "review", totalMs: ev.ms };
      }
      return s;
    }
    case "select":
      return { ...s, selected: a.key, pendingRule: a.key === s.selected ? s.pendingRule : null };
    case "fix": {
      const l = s.items[a.key];
      const iss = l?.issues[a.index];
      if (!iss) return s;
      const next = applyIssue(l, iss);
      const ask = (iss.field === "title" || iss.field === "description") && (iss.phrase || iss.fix.from);
      const rule = s.rules.find((r) => r.id === iss.ruleId);
      return {
        ...s,
        items: { ...s.items, [a.key]: next },
        pendingRule: ask
          ? { key: a.key, plat: rule?.plat ?? l.plat, text: `Không dùng “${iss.phrase ?? iss.fix.from}”. Viết lại theo hướng “${iss.fix.to}”.` }
          : null,
      };
    }
    case "fixSiblings": {
      const base = s.items[a.key];
      const items = { ...s.items };
      for (const p of PLATFORMS) {
        const k = keyOf(p.id, base.productId);
        const l = items[k];
        if (!l || k === a.key) continue;
        let cur = l;
        for (const iss of [...l.issues]) if (iss.ruleId === a.ruleId) cur = applyIssue(cur, iss);
        items[k] = cur;
      }
      return { ...s, items };
    }
    case "merge": {
      const l = s.items[a.key];
      if (!l || l.issues.length) return s;
      const items = { ...s.items, [a.key]: { ...l, merged: true, reopened: false } };
      const ns = { ...s, items };
      return { ...ns, selected: firstOpen(ns) ?? a.key, pendingRule: null };
    }
    case "mergeClean": {
      const items = { ...s.items };
      for (const k of Object.keys(items)) if (!items[k].issues.length) items[k] = { ...items[k], merged: true, reopened: false };
      return { ...s, items };
    }
    case "rule": {
      if (!s.pendingRule) return s;
      if (!a.accept) return { ...s, pendingRule: null };
      const id = `R-${String(s.rules.length + 1).padStart(2, "0")}`;
      const rule: Rule = { id, plat: s.pendingRule.plat, text: s.pendingRule.text, source: `Học từ lần chuyên viên sửa ${PNAME[s.items[s.pendingRule.key].plat]}` };
      return { ...s, rules: [...s.rules, rule], newRules: [...s.newRules, id], pendingRule: null };
    }
    case "learning":
      return { ...s, learning: a.on };
    case "learned": {
      const id = `R-${String(s.rules.length + 1).padStart(2, "0")}`;
      const rule: Rule = { id, plat: a.data.rule.plat, text: a.data.rule.text, source: "Học từ phản hồi của sàn" };
      const items = { ...s.items };
      const plats: PlatId[] = a.data.rule.plat === "all" ? ["sp", "tt", "lz"] : [a.data.rule.plat];
      for (const af of a.data.affected) {
        for (const plat of plats) {
          const k = keyOf(plat, af.productId);
          const l = items[k];
          if (!l) continue;
          const inText = af.field === "title" ? l.title.includes(af.phrase) : l.description.some((d) => d.includes(af.phrase));
          if (!inText) continue;
          const iss: Issue = { ruleId: id, severity: "bad", field: af.field, phrase: af.phrase, reason: a.data.explanation, fix: { from: af.phrase, to: af.replacement, label: af.label } };
          items[k] = { ...l, issues: [...l.issues, iss], reopened: l.merged, merged: false };
        }
      }
      return { ...s, items, rules: [...s.rules, rule], newRules: [...s.newRules, id], learning: false, lastLearned: a.data };
    }
    case "ads": {
      const ads = { ...s.ads };
      if (a.kit) ads[a.pid] = a.kit;
      else delete ads[a.pid];
      return { ...s, ads };
    }
    case "setTitle": {
      const l = s.items[a.key];
      if (!l) return s;
      const issues = l.issues.filter((i) => i.field !== "title" || (i.phrase ? a.title.includes(i.phrase) : false));
      return { ...s, items: { ...s.items, [a.key]: { ...l, title: a.title, issues, merged: false } } };
    }
    case "toast":
      return { ...s, toasts: [...s.toasts, { id: ++toastId, text: a.text, tone: a.tone }] };
    case "untoast":
      return { ...s, toasts: s.toasts.filter((x) => x.id !== a.id) };
  }
}

function firstOpen(s: State): string | null {
  for (const p of PLATFORMS) for (const k of s.order[p.id]) if (s.items[k]?.issues.length) return k;
  for (const p of PLATFORMS) for (const k of s.order[p.id]) if (s.items[k] && !s.items[k].merged) return k;
  return null;
}

/* ---------- đọc file ---------- */

const toB64 = (buf: ArrayBuffer) => {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export async function readFile(f: File): Promise<InFile> {
  const lower = f.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(await f.arrayBuffer());
    const text = wb.SheetNames.map((n) => `# Sheet ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n\n");
    return { name: f.name, mime: "text/csv", size: f.size, text };
  }
  if (f.type.startsWith("text/") || lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".md")) return { name: f.name, mime: "text/plain", size: f.size, text: await f.text() };
  return { name: f.name, mime: f.type || "application/pdf", size: f.size, data: toB64(await f.arrayBuffer()) };
}

export const SAMPLE_FILES = [
  { name: "HaVy_Catalog_T9-2026.pdf", url: "/samples/HaVy_Catalog_T9-2026.pdf", mime: "application/pdf" },
  { name: "BangGia_HaVy_cap-nhat-09-2026.csv", url: "/samples/BangGia_HaVy_cap-nhat-09-2026.csv", mime: "text/csv" },
];

export const SAMPLE_NOTICE = (cacheLearn as Learned).notice ?? "";

/* ---------- hook ---------- */

export function useLaunch() {
  const [s, dispatch] = useReducer(reducer, undefined, blank);
  const run = useRef(0);

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    if (tone === "ok") sonner.success(text);
    else if (tone === "warn") sonner.warning(text);
    else if (tone === "bad") sonner.error(text);
    else sonner(text);
  }, []);

  const replay = useCallback(async (mine: number) => {
    const evs = cacheLaunch as (Ev & { at: number })[];
    const t0 = Date.now();
    for (const ev of evs) {
      const wait = ev.at - (Date.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (mine !== run.current) return;
      dispatch({ t: "ev", ev });
    }
  }, []);

  const startCache = useCallback(async () => {
    const mine = ++run.current;
    dispatch({ t: "start", source: "cache", files: SAMPLE_FILES.map((f) => ({ name: f.name, size: 0, mime: f.mime })) });
    await replay(mine);
  }, [replay]);

  const start = useCallback(
    async (files: InFile[]) => {
      const mine = ++run.current;
      dispatch({ t: "start", source: "live", files: files.map((f) => ({ name: f.name, size: f.size, mime: f.mime })) });
      let gotProduct = false;
      try {
        const res = await fetch("/api/launch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files, rules: undefined }) });
        if (!res.ok || !res.body) throw new Error(`Máy chủ trả về ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (mine !== run.current) return;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i);
            buf = buf.slice(i + 1);
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as Ev;
            if (ev.type === "error") throw new Error(ev.message);
            if (ev.type === "product") gotProduct = true;
            dispatch({ t: "ev", ev });
          }
        }
      } catch (e) {
        if (mine !== run.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (!gotProduct) {
          toast(`Không gọi được Gemini (${msg}). Chuyển sang bản ghi sẵn.`, "warn");
          const m2 = ++run.current;
          dispatch({ t: "start", source: "cache", files: files.map((f) => ({ name: f.name, size: f.size, mime: f.mime })) });
          await replay(m2);
        } else toast(`Có lỗi giữa chừng: ${msg}`, "bad");
      }
    },
    [replay, toast],
  );

  const startSample = useCallback(async () => {
    try {
      const files: InFile[] = [];
      for (const f of SAMPLE_FILES) {
        const r = await fetch(f.url);
        if (!r.ok) throw new Error("không tải được file mẫu");
        if (f.mime === "text/csv") files.push({ name: f.name, mime: "text/plain", size: Number(r.headers.get("content-length") ?? 0), text: await r.text() });
        else {
          const buf = await r.arrayBuffer();
          files.push({ name: f.name, mime: f.mime, size: buf.byteLength, data: toB64(buf) });
        }
      }
      await start(files);
    } catch {
      await startCache();
    }
  }, [start, startCache]);

  const learn = useCallback(
    async (notice: string) => {
      dispatch({ t: "learning", on: true });
      const items = s.products.map((p) => ({
        productId: p.id,
        name: p.name,
        titles: Object.fromEntries(PLATFORMS.map((pl) => [pl.id, s.items[keyOf(pl.id, p.id)]?.title ?? ""])),
        claims: s.items[keyOf("lz", p.id)]?.description ?? p.claims.map((c) => c.text),
      }));
      try {
        if (s.source === "cache") throw new Error("cache");
        const res = await fetch("/api/learn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notice, items, rules: s.rules }) });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? res.statusText);
        dispatch({ t: "learned", data });
      } catch (e) {
        if (!(e instanceof Error && e.message === "cache")) toast("Không gọi được Gemini. Dùng kết quả đã ghi sẵn cho thông báo mẫu.", "warn");
        dispatch({ t: "learned", data: cacheLearn as Learned });
      }
    },
    [s.products, s.items, s.rules, s.source, toast],
  );

  const genAds = useCallback(
    async (pid: string) => {
      const product = s.products.find((p) => p.id === pid);
      if (!product) return;
      dispatch({ t: "ads", pid, kit: "loading" });
      const cached = (cacheAds as Record<string, AdsKit>)[pid];
      try {
        if (s.source === "cache") throw new Error("cache");
        const titles = Object.fromEntries(PLATFORMS.map((pl) => [pl.id, s.items[keyOf(pl.id, pid)]?.title ?? ""]));
        const res = await fetch("/api/ads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product, titles, rules: s.rules }) });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? res.statusText);
        dispatch({ t: "ads", pid, kit: data });
      } catch (e) {
        if (cached) {
          if (!(e instanceof Error && e.message === "cache")) toast("Không gọi được Gemini. Dùng bộ quảng cáo đã ghi sẵn.", "warn");
          dispatch({ t: "ads", pid, kit: cached });
        } else {
          toast("Không tạo được bộ quảng cáo cho sản phẩm này.", "bad");
          dispatch({ t: "ads", pid, kit: null });
        }
      }
    },
    [s.products, s.items, s.rules, s.source, toast],
  );

  const exportXlsx = useCallback(() => {
    const wb = XLSX.utils.book_new();
    for (const pl of PLATFORMS) {
      const rows = s.order[pl.id]
        .map((k) => s.items[k])
        .filter((l) => l?.merged)
        .map((l) => {
          const p = s.products.find((x) => x.id === l.productId);
          const row: Record<string, string | number> = { "Mã SKU": p?.sku ?? "", "Tên sản phẩm": l.title, "Danh mục": l.categoryPath.join(" > "), "Giá bán": l.price };
          for (const a of l.attributes) row[a.key] = a.value ?? "";
          row["Mô tả"] = l.description.join("\n");
          return row;
        });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Ghi chú": "Chưa có listing nào được merge" }]), pl.name);
    }
    XLSX.writeFile(wb, "LenSan_dang-hang-loat.xlsx");
    toast("Đã xuất file đăng hàng loạt (mẫu tham khảo, 3 sheet).", "ok");
  }, [s.order, s.items, s.products, toast]);

  return { s, dispatch, start, startSample, startCache, learn, genAds, exportXlsx, toast };
}

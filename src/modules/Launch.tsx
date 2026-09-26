import { useCallback, useState, type ReactNode } from "react";
import { baseState, fmtClock, useScenario, type Base, type Step } from "../lib/scenario";
import { PLATS, PNAME, type PlatId } from "../data/common";
import { CATS, NOTICE_TT, P, PRODUCTS, REQ, RULES_BASE, SAFE, STICKERS, TITLES, type Rule } from "../data/launch";
import { AgentLog, Ph, ScenarioBar, Sheet, StatusPill, flashProps } from "../components/ui";

interface Issue {
  rule: string;
  sev: "bad" | "warn";
  reason: string;
  fixLabel: string;
  fix: { type: "replace"; from: string; to: string } | { type: "attr"; key: string; value: string } | { type: "size"; from: string; to: string } | { type: "cat" } | { type: "img" };
  phrase?: string;
  attr?: string;
  cat?: boolean;
}
interface Listing {
  pid: string;
  plat: PlatId;
  title: string;
  cat: string[];
  catConf: number;
  catAlt: string[] | null;
  attrs: Record<string, string | null>;
  img: { sticker: string | null; note: string };
  issues: Issue[];
  scanned: boolean;
  approved: boolean;
  live: boolean;
  rejected: boolean;
  resub: boolean;
}
interface LS extends Base {
  read: boolean;
  shown: string[];
  L: Record<string, Listing>;
  rules: Rule[];
  newRules: string[];
  notice: string;
}

const key = (pid: string, plat: PlatId) => pid + "|" + plat;
const init = (): LS => ({ ...baseState(9 * 3600 + 12 * 60), read: false, shown: [], L: {}, rules: RULES_BASE.map((r) => ({ ...r })), newRules: [], notice: NOTICE_TT });
const all = (s: LS) => Object.values(s.L);

function build(pid: string, plat: PlatId): Listing {
  const p = P[pid];
  const every: Record<string, string | null> = { "Thương hiệu": "Hạ Vy Botanics", "Quy cách": p.size, "Xuất xứ": "Việt Nam", "Hạn sử dụng": p.hsd, "Số công bố": p.cb, "Phù hợp với": p.fit };
  const attrs: Record<string, string | null> = {};
  REQ[plat].forEach((k) => (attrs[k] = every[k] ?? null));
  const l: Listing = { pid, plat, title: TITLES[pid][plat], cat: CATS[pid][plat], catConf: 1, catAlt: null, attrs, img: { sticker: plat === "lz" ? STICKERS[pid] ?? null : null, note: "Ảnh #1 từ fanpage" }, issues: [], scanned: false, approved: false, live: false, rejected: false, resub: false };
  if (pid === "P4" && plat === "sp") {
    l.catConf = 0.64;
    l.catAlt = ["Sắc Đẹp", "Chăm sóc tóc", "Dầu gội trị gàu"];
  }
  return l;
}

function scan(s: LS, l: Listing): Issue[] {
  const p = P[l.pid];
  const out: Issue[] = [];
  const on = (id: string) => s.rules.some((r) => r.id === id);
  const m1 = l.title.match(/(trị dứt điểm[^,.;]*|chữa [^,.;]*|đặc trị[^,.;]*)/iu);
  if (m1) out.push({ rule: "R-01", sev: "bad", phrase: m1[0], reason: "Tuyên bố công dụng điều trị. Mỹ phẩm dùng câu này có nguy cơ bị đình chỉ trên cả 3 sàn.", fixLabel: `Thay bằng "${SAFE[l.pid]}"`, fix: { type: "replace", from: m1[0], to: SAFE[l.pid] } });
  if (l.plat === "tt") {
    const m2 = l.title.match(/\s*–[^–]*(Shopee|Lazada)[^–]*$/iu);
    if (m2) out.push({ rule: "R-02", sev: "bad", phrase: m2[0].trim(), reason: "Nhắc tên Shopee trong listing TikTok Shop. TikTok sẽ đình chỉ sản phẩm.", fixLabel: "Xoá cụm này khỏi tiêu đề", fix: { type: "replace", from: m2[0], to: "" } });
  }
  for (const k of REQ[l.plat])
    if (!l.attrs[k] && k === "Phù hợp với" && p.fitGuess)
      out.push({ rule: "R-03", sev: "warn", attr: k, reason: `Catalog không ghi "${k}". Agent suy ra "${p.fitGuess}" từ ${p.fitWhy}.`, fixLabel: `Xác nhận "${p.fitGuess}"`, fix: { type: "attr", key: k, value: p.fitGuess } });
  if (l.plat === "sp" && l.title.length > 120) out.push({ rule: "R-04", sev: "warn", reason: `Tiêu đề dài ${l.title.length} ký tự.`, fixLabel: "Rút gọn", fix: { type: "replace", from: l.title, to: l.title.slice(0, 118) } });
  if (p.conflict && l.attrs["Quy cách"] === p.conflict.from)
    out.push({ rule: "R-05", sev: "warn", phrase: p.conflict.from, attr: "Quy cách", reason: "PDF tr.10 ghi 4g, bảng giá Excel cập nhật 09/2026 ghi 3,5g. Agent đề xuất dùng số trong file mới hơn.", fixLabel: "Dùng 3,5g cho cả 3 sàn", fix: { type: "size", from: p.conflict.from, to: p.conflict.to } });
  if (l.catConf < 0.8 && l.catAlt)
    out.push({ rule: "R-06", sev: "warn", cat: true, reason: `Agent phân vân giữa "${l.cat.at(-1)}" và "${l.catAlt.at(-1)}" (độ tin cậy ${Math.round(l.catConf * 100)}%). Catalog không nhắc tới gàu nên nghiêng về "${l.cat.at(-1)}".`, fixLabel: `Xác nhận "${l.cat.at(-1)}"`, fix: { type: "cat" } });
  if (on("R-07") && l.plat === "lz" && l.img.sticker)
    out.push({ rule: "R-07", sev: "bad", reason: `Ảnh chính có nhãn "${l.img.sticker}" chèn lên. Lazada đã từ chối một listing vì lỗi này.`, fixLabel: "Đổi sang ảnh #3 từ fanpage (nền trơn)", fix: { type: "img" } });
  if (on("R-08") && l.plat === "tt") {
    const m = l.title.match(/【[^】]*】\s*|[🔥★]\s*/u);
    if (m) out.push({ rule: "R-08", sev: "warn", phrase: m[0].trim(), reason: "Theo thông báo mới, tiêu đề chứa ký tự trang trí sẽ bị hạn chế hiển thị từ 01/11/2026.", fixLabel: `Bỏ "${m[0].trim()}" khỏi tiêu đề`, fix: { type: "replace", from: m[0], to: "" } });
  }
  return out;
}

type St = "draft" | "ok" | "warn" | "bad" | "approved" | "live" | "rejected" | "resub";
const LABEL: Record<St, string> = { draft: "Nháp", ok: "Sẵn sàng duyệt", warn: "Cần xem", bad: "Vi phạm", approved: "Đã duyệt", live: "Đang bán", rejected: "Bị từ chối", resub: "Đã nộp lại" };
function status(l: Listing): St {
  if (!l.scanned) return "draft";
  if (l.rejected) return "rejected";
  if (l.resub) return "resub";
  if (l.issues.some((i) => i.sev === "bad")) return "bad";
  if (l.issues.length) return "warn";
  if (l.live) return "live";
  if (l.approved) return "approved";
  return "ok";
}
function applyFix(s: LS, l: Listing, iss: Issue) {
  const f = iss.fix;
  if (f.type === "replace") l.title = l.title.replace(f.from, f.to).replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim();
  if (f.type === "attr") l.attrs[f.key] = f.value;
  if (f.type === "size") {
    l.attrs["Quy cách"] = f.to;
    l.title = l.title.replace(f.from, f.to);
  }
  if (f.type === "cat") l.catConf = 1;
  if (f.type === "img") l.img = { sticker: null, note: "Ảnh #3 từ fanpage, nền trơn" };
  l.issues = scan(s, l);
}
const rescan = (s: LS) => all(s).forEach((l) => l.scanned && (l.issues = scan(s, l)));

const STEPS: Step<LS>[] = [
  {
    name: "Nhận catalog",
    btn: "Đọc catalog",
    desc: <>Brand gửi 1 file PDF 14 trang, 1 bảng giá Excel và 23 ảnh fanpage. Agent gom lại thành <b>1 bản dữ liệu gốc cho mỗi sản phẩm</b> và chỉ ra chỗ các nguồn mâu thuẫn nhau.</>,
    async run(s, io) {
      await io.say("Nhận 3 nguồn từ brand Hạ Vy Botanics: 1 PDF, 1 file Excel, 23 ảnh fanpage.");
      await io.say("Đọc Catalog_HaVy_T9-2026.pdf: 14 trang, có bảng thành phần và ảnh chụp bao bì.");
      s.read = true;
      for (const p of PRODUCTS) {
        await io.say(`Tìm thấy ${p.name} · ${p.size} · ${p.src}`, "sub", 300);
        s.shown.push(p.id);
      }
      await io.say("Đối chiếu với bảng giá Excel: Son dưỡng dầu dừa lệch quy cách (PDF ghi 4g, Excel ghi 3,5g).", "warn");
      await io.say("Kem chống nắng: catalog không ghi loại da phù hợp. Agent sẽ suy ra từ mô tả và đánh dấu để người xác nhận.", "warn");
      await io.say("Xong: 6 sản phẩm trong dữ liệu gốc, 2 điểm cần xác nhận.", "ok");
    },
  },
  {
    name: "Tạo listing 3 sàn",
    btn: "Tạo listing",
    desc: <>Mỗi sàn một subagent chạy song song: chọn danh mục trong cây của sàn đó, điền thuộc tính bắt buộc, viết tiêu đề theo quy ước riêng.</>,
    async run(s, io) {
      await io.say("Tạo 3 subagent chạy song song, mỗi sàn một subagent.");
      for (const pl of PLATS) {
        await io.say(`[${pl.name}] Ghép 6 sản phẩm vào cây danh mục, điền ${REQ[pl.id].length} thuộc tính bắt buộc, viết tiêu đề theo quy ước của sàn.`, "sub", 380);
        for (const p of PRODUCTS) s.L[key(p.id, pl.id)] = build(p.id, pl.id);
        io.commit();
      }
      await io.say('[Shopee] Dầu gội bưởi: phân vân giữa "Dầu gội" và "Dầu gội trị gàu" (độ tin cậy 64%).', "warn");
      await io.say('[Lazada] Kem chống nắng thiếu thuộc tính bắt buộc "Phù hợp với".', "warn");
      await io.say("Xong: 18 listing nháp.", "ok");
    },
  },
  {
    name: "Soát vi phạm",
    btn: "Soát vi phạm",
    desc: <>Đối chiếu 18 listing với Sổ luật. Mỗi lỗi có <b>câu bị gạch chân, lý do và bản sửa đề xuất</b>.</>,
    async run(s, io) {
      await io.say(`Soát 18 listing với ${s.rules.length} luật trong Sổ luật.`);
      for (const pl of PLATS) {
        await io.sleep(300);
        PRODUCTS.forEach((p) => {
          const l = s.L[key(p.id, pl.id)];
          l.scanned = true;
          l.issues = scan(s, l);
        });
        io.commit();
      }
      const c = (st: St) => all(s).filter((l) => status(l) === st).length;
      await io.say('Serum Vitamin C: "trị dứt điểm nám" là tuyên bố điều trị, lỗi trên cả 3 sàn.', "warn", 300);
      await io.say('Dầu gội bưởi: "chữa rụng tóc" là tuyên bố điều trị, lỗi trên cả 3 sàn.', "warn", 300);
      await io.say("TikTok Shop · Sữa rửa mặt trà xanh: tiêu đề nhắc tên Shopee Mall.", "warn", 300);
      await io.say(`Kết quả: ${c("bad")} vi phạm, ${c("warn")} cần xem, ${c("ok")} sẵn sàng duyệt.`, "ok");
    },
  },
  {
    name: "Chuyên viên duyệt",
    btn: "Bắt đầu duyệt",
    desc: <>Bấm vào ô đỏ hoặc vàng để xem lý do và áp dụng bản sửa. Ô xanh có thể duyệt hàng loạt. Agent không tự đăng khi còn lỗi.</>,
    async run(_s, io) {
      await io.say("Chờ chuyên viên duyệt. Bấm vào ô đỏ hoặc vàng để xem lý do và áp dụng bản sửa.", "human", 200);
    },
  },
  {
    name: "Sàn từ chối",
    btn: "Đăng lên sàn",
    desc: <>Đăng các listing đã duyệt. Lazada từ chối 1 listing. Agent đọc lý do, tự sửa, nộp lại, <b>ghi luật mới vào Sổ luật</b> rồi quét lại các listing khác.</>,
    async run(s, io) {
      const pend = all(s).filter((l) => status(l) === "ok");
      if (pend.length) {
        pend.forEach((l) => (l.approved = true));
        await io.say(`Chuyên viên duyệt nốt ${pend.length} listing không có vấn đề.`, "human", 250);
      }
      const pub = all(s).filter((l) => status(l) === "approved");
      await io.say(`Đăng ${pub.length} listing đã duyệt lên 3 sàn.`);
      pub.forEach((l) => (l.pid === "P6" && l.plat === "lz" ? (l.rejected = true) : (l.live = true)));
      io.commit();
      const left = all(s).filter((l) => ["bad", "warn"].includes(status(l))).length;
      if (left) await io.say(`${left} listing còn vấn đề chưa xử lý, chưa được đăng.`, "sub", 250);
      const lz = s.L[key("P6", "lz")];
      if (!lz.rejected) {
        lz.issues = [];
        lz.approved = true;
        lz.rejected = true;
      }
      await io.say('Lazada từ chối "Mặt nạ ngủ rau má": ảnh chính chứa văn bản hoặc nhãn khuyến mãi (IMG_TEXT_OVERLAY).', "platform", 900);
      io.flash(key("P6", "lz"));
      await io.say('Đọc lý do từ chối. Nguyên nhân: ảnh chính có nhãn "SALE 50%" do brand chèn khi đăng fanpage.', "agent", 800);
      s.rules.push({ id: "R-07", plat: "lz", text: "Ảnh chính không được chèn chữ hoặc nhãn khuyến mãi (SALE, FREESHIP…).", src: `Học từ lần Lazada từ chối Mặt nạ ngủ rau má · ${fmtClock(s.clock)}` });
      s.newRules.push("R-07");
      await io.say("Ghi luật mới R-07 vào Sổ luật: Lazada không nhận ảnh chính có chữ khuyến mãi.", "ok");
      lz.img = { sticker: null, note: "Ảnh #3 từ fanpage, nền trơn" };
      lz.rejected = false;
      lz.resub = true;
      await io.say("Đổi sang ảnh #3 từ fanpage (nền trơn) và nộp lại lên Lazada.");
      await io.sleep(900);
      lz.resub = false;
      lz.live = true;
      lz.issues = scan(s, lz);
      io.flash(key("P6", "lz"));
      await io.say('Lazada duyệt lại "Mặt nạ ngủ rau má". Đang bán.', "platform", 200);
      await io.say("Quét lại 18 listing với luật R-07.", "agent", 600);
      rescan(s);
      io.flash(key("P2", "lz"));
      await io.say('Tìm thấy thêm 1 listing cùng lỗi: Sữa rửa mặt trà xanh trên Lazada có nhãn "FREESHIP". Đã soạn bản sửa, chờ duyệt trước khi Lazada phát hiện.', "warn");
    },
  },
  {
    name: "Sàn đổi chính sách",
    btn: "Đọc thông báo",
    desc: <>Dán thông báo mới của sàn vào ô bên dưới. Agent chuyển nó thành luật và quét lại các listing đang bán.</>,
    async run(s, io) {
      await io.say("Đọc thông báo TikTok Shop vừa dán vào.");
      await io.say("Trích ra 1 thay đổi: từ 01/11/2026 tiêu đề không được chứa emoji hoặc ký tự trang trí. Áp dụng cho TikTok Shop.", "agent", 700);
      s.rules.push({ id: "R-08", plat: "tt", text: "Từ 01/11/2026, tiêu đề không chứa emoji hoặc ký tự trang trí như 【】, ★, 🔥.", src: `Học từ thông báo TikTok Shop dán vào lúc ${fmtClock(s.clock)}` });
      s.newRules.push("R-08");
      await io.say("Ghi luật mới R-08 vào Sổ luật.", "ok");
      rescan(s);
      const hit = all(s).filter((l) => l.issues.some((i) => i.rule === "R-08"));
      hit.forEach((l) => io.flash(key(l.pid, l.plat)));
      await io.say(`Quét lại: ${hit.length} listing TikTok Shop có "【Chính Hãng】" trong tiêu đề (${hit.map((l) => P[l.pid].name).join(", ")}). Đã soạn bản sửa, cần duyệt trước 01/11.`, "warn");
    },
  },
];

function hl(title: string, issues: Issue[]) {
  const phrases = issues.filter((i) => i.phrase && title.includes(i.phrase));
  if (!phrases.length) return title;
  const parts: ReactNode[] = [title];
  phrases.forEach((iss, n) => {
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (typeof part !== "string") continue;
      const at = part.indexOf(iss.phrase!);
      if (at < 0) continue;
      parts.splice(i, 1, part.slice(0, at), <mark key={n} className={iss.sev}>{iss.phrase}</mark>, part.slice(at + iss.phrase!.length));
      break;
    }
  });
  return parts;
}

export default function Launch() {
  const { s, steps, runNext, reset, commit, human } = useScenario(init, STEPS, 3);
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const ls = all(s);
  const counts = { bad: 0, warn: 0, ok: 0, approved: 0, live: 0 };
  ls.forEach((l) => {
    const st = status(l);
    if (st === "rejected") counts.bad++;
    else if (st === "resub") counts.live++;
    else if (st in counts) counts[st as keyof typeof counts]++;
  });
  const fixable = ls.filter((l) => !l.rejected && l.issues.length).length;

  const humanFix = (k: string, i: number) => {
    const l = s.L[k];
    const iss = l.issues[i];
    if (!iss) return;
    applyFix(s, l, iss);
    if (iss.fix.type === "size")
      PLATS.forEach((pl) => {
        const o = s.L[key(l.pid, pl.id)];
        const j = o?.issues.find((x) => x.rule === "R-05");
        if (o && o !== l && j) applyFix(s, o, j);
      });
    s.flash[k] = Date.now();
    human(`Chuyên viên áp dụng sửa ${iss.rule} · ${P[l.pid].name} (${PNAME[l.plat]})${iss.fix.type === "size" ? ", áp dụng 3,5g cho cả 3 sàn" : ""}${l.live && !l.issues.length ? ". Đã đẩy bản cập nhật lên sàn." : "."}`);
  };
  const approve = (k: string) => {
    const l = s.L[k];
    if (status(l) !== "ok") return;
    l.approved = true;
    human(`Chuyên viên duyệt ${P[l.pid].name} (${PNAME[l.plat]}).`);
  };
  const approveAll = () => {
    const pend = ls.filter((l) => status(l) === "ok");
    pend.forEach((l) => (l.approved = true));
    human(`Chuyên viên duyệt hàng loạt ${pend.length} listing không có vấn đề.`);
  };
  const fixAll = () => {
    let n = 0;
    ls.forEach((l) => {
      if (l.rejected) return;
      let guard = 0;
      while (l.issues.length && guard++ < 6) {
        applyFix(s, l, l.issues[0]);
        n++;
      }
    });
    human(`Chuyên viên chấp nhận ${n} bản sửa đề xuất.`);
  };

  const ol = open ? s.L[open] : null;
  const ost = ol ? status(ol) : "draft";
  const op = ol ? P[ol.pid] : null;

  return (
    <div className="module">
      <ScenarioBar steps={steps} s={s} onRun={runNext} onReset={() => { close(); void reset(0); }}>
        {s.step === 5 && (
          <div className="notice">
            <label htmlFor="notice">Thông báo của sàn (dán nguyên văn)</label>
            <textarea id="notice" value={s.notice} onChange={(e) => { s.notice = e.target.value; commit(); }} />
          </div>
        )}
      </ScenarioBar>

      <div className="cols-3">
        <section className="panel" aria-label="Nguồn và dữ liệu gốc">
          <div className="eyebrow">Brand gửi</div>
          <div className="files">
            {[
              ["PDF", "Catalog_HaVy_T9-2026.pdf", "14 trang"],
              ["XLSX", "BangGia_HaVy_cap-nhat-09-2026.xlsx", "6 dòng"],
              ["JPG", "Ảnh fanpage Hạ Vy", "23 ảnh"],
            ].map(([e, n, m]) => (
              <div className="file" key={e}>
                <span className="ext">{e}</span>
                <div>
                  <b>{n}</b>
                  <small className={s.read ? "read" : ""}>{m} · {s.read ? "đã đọc" : "chưa đọc"}</small>
                </div>
              </div>
            ))}
          </div>
          <h2 className="h2">Dữ liệu gốc <small>{s.shown.length ? `${s.shown.length} sản phẩm` : ""}</small></h2>
          {s.shown.length ? (
            <ul className="plist">
              {s.shown.map((id) => {
                const p = P[id];
                return (
                  <li key={id}>
                    <Ph hue={p.hue} short={p.short} />
                    <div>
                      <b>{p.name}</b>
                      <div className="meta mono">{p.size} · {p.src}</div>
                      {p.flag && <span className="flag">⚠ {p.flag}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty">Chưa đọc catalog. Chạy bước 1 để agent đọc 3 nguồn.</p>
          )}
        </section>

        <section className="panel" aria-label="Listing theo sàn">
          <div className="toolbar">
            <div className="counts">
              {([["bad", "Vi phạm"], ["warn", "Cần xem"], ["ok", "Sẵn sàng duyệt"], ["approved", "Đã duyệt"], ["live", "Đang bán"]] as const).map(([k, t]) => (
                <span key={k} className={`count s-${k}`}><i className="dot" />{t} <b>{counts[k]}</b></span>
              ))}
            </div>
            <div className="btns">
              <button className="btn" type="button" disabled={s.busy || s.step < 3 || !fixable} onClick={fixAll}>Áp dụng mọi đề xuất ({fixable})</button>
              <button className="btn" type="button" disabled={s.busy || s.step < 3 || !counts.ok} onClick={approveAll}>Duyệt tất cả ô xanh ({counts.ok})</button>
            </div>
          </div>
          <div className="scroll-x">
            <table className="lg">
              <thead>
                <tr><th />{PLATS.map((p) => <th key={p.id} scope="col">{p.name}</th>)}</tr>
              </thead>
              <tbody>
                {PRODUCTS.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">
                      <div className="rowh">
                        <Ph hue={p.hue} short={p.short} />
                        <div><b>{p.name}</b><small className="mono">{s.L[key(p.id, "sp")]?.attrs["Quy cách"] ?? p.size}</small></div>
                      </div>
                    </th>
                    {PLATS.map((pl) => {
                      const k = key(p.id, pl.id);
                      const l = s.L[k];
                      if (!l)
                        return (
                          <td key={pl.id}><button className="cell s-draft" disabled><span className="cell-top"><b>Chưa có listing</b></span><span className="cell-title">Chạy bước 2</span></button></td>
                        );
                      const st = status(l);
                      const fp = flashProps(s, k);
                      return (
                        <td key={pl.id}>
                          <button key={fp.key} className={`cell s-${st}${fp.className}`} type="button" onClick={() => setOpen(k)} aria-label={`${p.name} trên ${pl.name}: ${LABEL[st]}`}>
                            <span className="cell-top">
                              <i className="dot" /><b>{LABEL[st]}</b>
                              {l.issues.length > 0 && <small>{l.issues.length} vấn đề</small>}
                              {l.live && (st === "bad" || st === "warn") && <span className="tag">đang bán</span>}
                            </span>
                            <span className="cell-title">{l.title}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="panel stack">
          <section className="sec" aria-label="Sổ luật">
            <h2 className="h2">Sổ luật <small>{s.rules.length} luật · luật mẫu để minh họa</small></h2>
            <ul className="rules">
              {[...s.rules].reverse().map((r) => {
                const isNew = s.newRules.includes(r.id);
                return (
                  <li key={r.id} className={`rule${isNew ? " new" : ""}`}>
                    <header><span className="rid mono">{r.id}</span><span className="pl">{r.plat === "all" ? "Cả 3 sàn" : PNAME[r.plat]}</span>{isNew && <span className="newtag">Mới học</span>}</header>
                    <p>{r.text}</p>
                    <small>{r.src}</small>
                  </li>
                );
              })}
            </ul>
          </section>
          <AgentLog log={s.log} />
        </div>
      </div>

      <Sheet
        open={!!ol}
        onClose={close}
        eyebrow={ol ? `${PNAME[ol.plat]} · ${ol.pid}` : ""}
        title={op?.name ?? ""}
        badge={ol && <StatusPill cls={ost}>{LABEL[ost]}</StatusPill>}
        footer={
          ol && (
            <>
              {ost === "ok" && <button className="btn pri" type="button" onClick={() => approve(open!)}>Duyệt listing này</button>}
              {ost === "approved" && <StatusPill cls="approved">Đã duyệt, chờ đăng</StatusPill>}
              {ost === "live" && <StatusPill cls="live">Đang bán trên {PNAME[ol.plat]}</StatusPill>}
              {(ost === "bad" || ost === "warn") && <span className="muted small">Xử lý hết vấn đề để duyệt</span>}
            </>
          )
        }
      >
        {ol && op && (
          <>
            {ol.rejected && (
              <div className="reject"><b>Lazada từ chối listing này</b><p className="mono small">Ảnh chính chứa văn bản hoặc nhãn khuyến mãi. Vui lòng dùng ảnh không chèn chữ. (IMG_TEXT_OVERLAY · phản hồi mô phỏng)</p></div>
            )}
            <div className="sec">
              <div className="eyebrow">Danh mục trên {PNAME[ol.plat]}</div>
              <div className="crumb">{ol.cat.map((c) => <span key={c}>{c}</span>)}</div>
              {ol.catConf < 0.8 && ol.catAlt && <div className="conf">Độ tin cậy {Math.round(ol.catConf * 100)}% · phương án khác: {ol.catAlt.join(" › ")}</div>}
            </div>
            <div className="sec">
              <div className="eyebrow">Tiêu đề{ol.plat === "sp" && <span className="mono"> · {ol.title.length}/120 ký tự</span>}</div>
              <div className="ttl">{hl(ol.title, ol.issues)}</div>
            </div>
            <div className="sec">
              <div className="eyebrow">Thuộc tính bắt buộc của {PNAME[ol.plat]}</div>
              <dl className="attrs">
                {REQ[ol.plat].map((k) => {
                  const ai = ol.issues.find((i) => i.attr === k);
                  const v = ol.attrs[k];
                  return (
                    <div key={k} className="attr-row">
                      <dt>{k}</dt>
                      <dd>{v ? (ai ? <mark className="warn">{v}</mark> : v) : <span className="miss">Chưa có{ai && ai.fix.type === "attr" ? ` · agent đề xuất "${ai.fix.value}"` : ""}</span>}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
            <div className="sec">
              <div className="eyebrow">Ảnh chính</div>
              <div className="imgrow">
                <Ph big hue={op.hue} short={op.short} sticker={ol.img.sticker} />
                <div><div>{ol.img.note}</div><small className="muted">{ol.img.sticker ? `Có nhãn "${ol.img.sticker}" do brand chèn cho fanpage` : "Nền trơn, không chèn chữ"}</small></div>
              </div>
            </div>
            <div className="sec">
              <div className="eyebrow">Vấn đề ({ol.issues.length})</div>
              {ol.issues.length ? (
                <ul className="issues">
                  {ol.issues.map((i, n) => (
                    <li key={i.rule + n} className={`issue ${i.sev}`}>
                      <header><span className="rid mono">{i.rule}</span><b>{i.sev === "bad" ? "Vi phạm" : "Cần xem"}</b></header>
                      <p>{i.reason}</p>
                      <button className="btn" type="button" disabled={s.busy} onClick={() => humanFix(open!, n)}>{i.fixLabel}</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="okmsg">Không có vấn đề nào theo {s.rules.length} luật hiện có.</p>
              )}
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

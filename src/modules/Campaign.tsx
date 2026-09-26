import { useState } from "react";
import { baseState, useScenario, type Base, type Step } from "../lib/scenario";
import { BRANDS, PLATS, TODAY, vnd, type PlatId } from "../data/common";
import { AgentLog, ScenarioBar, flashProps } from "../components/legacy";

/* ---------- Lịch sale ---------- */

const d = (m: number, day: number) => new Date(2026, m - 1, day);
const START = d(9, 14), END = d(12, 20);
const DAY = 86400000;
const span = (END.getTime() - START.getTime()) / DAY;

const WINDOWS: Record<PlatId, { label: string; from: Date; to: Date }[]> = {
  sp: [{ label: "ĐK 10.10", from: d(9, 15), to: d(9, 28) }, { label: "ĐK 11.11", from: d(10, 6), to: d(10, 20) }, { label: "ĐK 12.12", from: d(11, 10), to: d(11, 24) }],
  tt: [{ label: "ĐK 10.10", from: d(9, 18), to: d(9, 30) }, { label: "ĐK 11.11", from: d(10, 12), to: d(10, 25) }, { label: "ĐK 12.12", from: d(11, 15), to: d(11, 28) }],
  lz: [{ label: "ĐK 10.10", from: d(9, 16), to: d(9, 27) }, { label: "ĐK 11.11", from: d(10, 8), to: d(10, 22) }, { label: "ĐK 12.12", from: d(11, 12), to: d(11, 26) }],
};
const MEGA = [
  { label: "10.10", at: d(10, 10) },
  { label: "Payday", at: d(10, 25) },
  { label: "11.11", at: d(11, 11) },
  { label: "Black Friday", at: d(11, 27) },
  { label: "12.12", at: d(12, 12) },
];
const fmtD = (x: Date) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`;
const daysLeft = (x: Date) => Math.round((x.getTime() - TODAY.getTime()) / DAY);

function SaleCalendar() {
  const W = 900, left = 96, right = 16, top = 34, rowH = 40;
  const H = top + rowH * PLATS.length + 26;
  const x = (t: Date) => left + ((t.getTime() - START.getTime()) / DAY / span) * (W - left - right);
  const months = [d(10, 1), d(11, 1), d(12, 1)];
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="scroll-x">
      <svg className="gantt" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Lịch đăng ký chương trình sale trên 3 sàn từ giữa tháng 9 đến giữa tháng 12">
        {months.map((m) => (
          <g key={m.getTime()}>
            <line x1={x(m)} x2={x(m)} y1={top - 6} y2={H - 22} className="grid" />
            <text x={x(m) + 4} y={H - 8} className="tick">Tháng {m.getMonth() + 1}</text>
          </g>
        ))}
        {MEGA.map((m) => (
          <g key={m.label}>
            <line x1={x(m.at)} x2={x(m.at)} y1={top - 6} y2={H - 22} className="mega" />
            <text x={x(m.at)} y={top - 12} textAnchor="middle" className="mlabel">{m.label}</text>
          </g>
        ))}
        {PLATS.map((p, i) => {
          const y = top + i * rowH;
          return (
            <g key={p.id}>
              <text x={0} y={y + rowH / 2 + 4} className="rowlabel">{p.name}</text>
              <line x1={left} x2={W - right} y1={y + rowH} y2={y + rowH} className="grid" />
              {WINDOWS[p.id].map((w) => {
                const id = p.id + w.label;
                const past = w.to < TODAY;
                const soon = !past && w.from <= TODAY;
                return (
                  <g key={id} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}>
                    <rect x={x(w.from)} y={y + 10} width={Math.max(4, x(w.to) - x(w.from))} height={20} rx={4} className={soon ? "bar-soon" : past ? "bar-past" : "bar"} />
                    <text x={x(w.from) + 6} y={y + 24} className="barlabel">{w.label}</text>
                    {hover === id && (
                      <g className="tip">
                        <rect x={Math.min(x(w.from), W - 190)} y={y - 16} width={180} height={24} rx={5} />
                        <text x={Math.min(x(w.from), W - 190) + 8} y={y}>{p.name} · {w.label}: {fmtD(w.from)}–{fmtD(w.to)}</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        <line x1={x(TODAY)} x2={x(TODAY)} y1={top - 6} y2={H - 22} className="today" />
        <text x={x(TODAY) - 4} y={H - 8} textAnchor="end" className="today-label">Hôm nay {fmtD(TODAY)}</text>
      </svg>
    </div>
  );
}

type Phase = "done" | "doing" | "todo" | "blocked" | "skip";
const PHASES = ["Chọn SKU", "Đăng ký chương trình", "Cài giá & voucher", "Phân bổ tồn kho", "Soát trước giờ mở", "Mở bán 10.10"];
const PLAN: Record<string, { phases: Phase[]; note: string }> = {
  hv: { phases: ["skip", "skip", "skip", "skip", "skip", "skip"], note: "Mở bán 03/10, không kịp hạn đăng ký 10.10. Agent đề xuất nhắm 11.11: hạn Shopee 20/10." },
  ta: { phases: ["done", "blocked", "todo", "todo", "todo", "todo"], note: "2 SKU chưa đủ điều kiện: giá sale phải thấp hơn giá thấp nhất 30 ngày qua (luật mẫu)." },
  bn: { phases: ["done", "done", "done", "done", "doing", "todo"], note: "Đang soát cấu hình trước giờ mở bán. Xem kịch bản bên dưới." },
};
const PH_LABEL: Record<Phase, string> = { done: "Xong", doing: "Đang làm", todo: "Chưa làm", blocked: "Vướng", skip: "Không tham gia" };

/* ---------- Soát trước giờ mở bán ---------- */

interface Row { id: string; name: string; list: number; sale: number; cost: number; voucher: string; stock: Record<PlatId, number> }
const ROWS: Row[] = [
  { id: "S1", name: "Sữa tắm gội thảo dược 500ml", list: 229000, sale: 189000, cost: 120000, voucher: "Shop 10%", stock: { sp: 400, tt: 300, lz: 150 } },
  { id: "S2", name: "Tã quần size L 52 miếng", list: 329000, sale: 279000, cost: 205000, voucher: "Shop 30%, tối đa 60k", stock: { sp: 800, tt: 600, lz: 300 } },
  { id: "S3", name: "Khăn sữa 10 cái", list: 99000, sale: 79000, cost: 42000, voucher: "Không", stock: { sp: 500, tt: 500, lz: 200 } },
  { id: "S4", name: "Bình sữa cổ rộng 150ml", list: 259000, sale: 219000, cost: 160000, voucher: "Shop 15%", stock: { sp: 300, tt: 200, lz: 100 } },
  { id: "S5", name: "Kem hăm tã 50g", list: 149000, sale: 119000, cost: 64000, voucher: "Shop 10%", stock: { sp: 300, tt: 300, lz: 120 } },
  { id: "S6", name: "Nước giặt đồ sơ sinh 1L", list: 189000, sale: 159000, cost: 95000, voucher: "Shop 10%", stock: { sp: 600, tt: 400, lz: 200 } },
];
interface Cfg { price: number; stock: number; issue?: { sev: "bad" | "warn"; text: string; fix: string }; fixed?: boolean }
const CFG_ISSUES: Record<string, Cfg["issue"]> = {
  "S6|sp": { sev: "bad", text: "Giá flash sale cài 15.900đ, kế hoạch 159.000đ. Thấp hơn giá vốn 95.000đ.", fix: "Sửa về 159.000đ" },
  "S3|tt": { sev: "warn", text: "Tồn kho phân bổ 50, kế hoạch 500. Sẽ hết hàng trong vài phút đầu.", fix: "Phân bổ lại 500" },
  "S4|sp": { sev: "warn", text: "Voucher shop 15% cộng dồn voucher sàn 20% → khách trả 148.920đ, thấp hơn giá vốn 160.000đ.", fix: "Không cho cộng dồn voucher sàn" },
};
const WRONG_PRICE: Record<string, number> = { "S6|sp": 15900 };
const WRONG_STOCK: Record<string, number> = { "S3|tt": 50 };

interface CS extends Base {
  planRead: boolean;
  cfg: Record<string, Cfg>;
  checked: boolean;
  banner: "unchecked" | "bad" | "fixed";
}
const ck = (r: string, p: PlatId) => r + "|" + p;
const cinit = (): CS => ({ ...baseState(10 * 3600 + 30 * 60), planRead: false, cfg: {}, checked: false, banner: "unchecked" });

const CSTEPS: Step<CS>[] = [
  {
    name: "Đọc kế hoạch",
    btn: "Đọc Google Sheet",
    desc: <>Kế hoạch 10.10 của Bông Nhỏ nằm trong Google Sheet: giá sale, voucher, tồn kho phân bổ cho từng sàn.</>,
    async run(s, io) {
      await io.say("Đọc sheet “Bông Nhỏ · 10.10 · v7”: 6 SKU, 3 sàn.");
      s.planRead = true;
      await io.say("Ghi nhận giá vốn từ tab “Giá vốn” để tính mức giá tối thiểu.", "sub");
    },
  },
  {
    name: "Đọc cấu hình trên sàn",
    btn: "Đọc cấu hình",
    desc: <>Agent đọc giá, voucher và tồn kho <b>đang được cài thật</b> trong chương trình trên từng sàn.</>,
    async run(s, io) {
      for (const p of PLATS) {
        await io.say(`[${p.name}] Đọc cấu hình flash sale và voucher cho 6 SKU.`, "sub", 450);
        ROWS.forEach((r) => (s.cfg[ck(r.id, p.id)] = { price: WRONG_PRICE[ck(r.id, p.id)] ?? r.sale, stock: WRONG_STOCK[ck(r.id, p.id)] ?? r.stock[p.id] }));
        io.commit();
      }
      await io.say("Đọc banner chương trình “Siêu sale 10.10 – Tã quần giảm 50%”.", "sub");
    },
  },
  {
    name: "Soát",
    btn: "Soát so với kế hoạch",
    desc: <>So từng ô với kế hoạch, tính giá khách thực trả sau khi cộng dồn voucher, và đọc chữ trên banner để so với voucher thật.</>,
    async run(s, io) {
      await io.say("So 18 cấu hình với kế hoạch và giá vốn.");
      for (const [id, iss] of Object.entries(CFG_ISSUES)) {
        await io.sleep(250);
        s.cfg[id].issue = iss;
        io.flash(id);
        io.commit();
      }
      s.checked = true;
      await io.say("Shopee · Nước giặt đồ sơ sinh: giá flash sale 15.900đ, thiếu một số 0.", "platform", 400);
      await io.say("Bình sữa trên Shopee: cộng dồn voucher làm giá khách trả thấp hơn giá vốn.", "warn", 300);
      await io.say("TikTok Shop · Khăn sữa: tồn kho phân bổ 50 thay vì 500.", "warn", 300);
      s.banner = "bad";
      io.flash("banner");
      await io.say('Banner ghi "Giảm 50%" nhưng voucher thật là 30%, tối đa 60k. Dễ bị khiếu nại quảng cáo sai.', "warn", 400);
    },
  },
  {
    name: "Sửa trước giờ mở",
    btn: "Duyệt các bản sửa",
    desc: <>Agent đã soạn sẵn bản sửa. Chuyên viên duyệt từng ô hoặc duyệt tất cả. Mở bán sau 13 ngày.</>,
    async run(s, io) {
      for (const [id, c] of Object.entries(s.cfg)) {
        if (c.issue && !c.fixed) {
          fix(s, id);
          io.flash(id);
          await io.say(`Chuyên viên duyệt: ${c.issue.fix} (${id.replace("|", " · ")}).`, "human", 300);
        }
      }
      if (s.banner === "bad") {
        s.banner = "fixed";
        await io.say('Chuyên viên duyệt: sửa banner thành "Giảm đến 30%".', "human", 300);
      }
      await io.say("18/18 cấu hình khớp kế hoạch. Agent sẽ soát lại lần cuối lúc 23:00 ngày 09/10.", "ok");
    },
  },
];

function fix(s: CS, id: string) {
  const c = s.cfg[id];
  const r = ROWS.find((x) => x.id === id.split("|")[0])!;
  const p = id.split("|")[1] as PlatId;
  c.price = r.sale;
  c.stock = r.stock[p];
  c.fixed = true;
}

function Guard() {
  const { s, steps, runNext, reset, human } = useScenario(cinit, CSTEPS, 3);
  const open = Object.entries(s.cfg).filter(([, c]) => c.issue && !c.fixed).length + (s.banner === "bad" ? 1 : 0);
  return (
    <div className="module">
      <ScenarioBar steps={steps} s={s} onRun={runNext} onReset={() => void reset(0)} />
      <div className="cols-2">
        <section className="panel" aria-label="Kế hoạch và cấu hình thật">
          <div className="toolbar">
            <h2 className="h2">Bông Nhỏ · 10.10 <small>Kế hoạch so với cấu hình thật</small></h2>
            <span className={`count ${open ? "s-bad" : "s-ok"}`}><i className="dot" />{open ? `${open} chỗ chưa khớp` : s.checked ? "Tất cả đã khớp" : "Chưa soát"}</span>
          </div>
          <div className="scroll-x">
            <table className="lg plan">
              <thead>
                <tr><th>SKU</th><th>Kế hoạch</th>{PLATS.map((p) => <th key={p.id}>{p.name}</th>)}</tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.id}>
                    <th scope="row"><div className="rowh2"><b>{r.name}</b><small className="mono">Giá vốn {vnd(r.cost)}</small></div></th>
                    <td>{s.planRead ? <div className="cell static s-draft"><span className="mono">{vnd(r.sale)}</span><span className="cell-note">{r.voucher}</span></div> : <span className="muted">—</span>}</td>
                    {PLATS.map((p) => {
                      const id = ck(r.id, p.id);
                      const c = s.cfg[id];
                      if (!c) return <td key={p.id}><span className="muted">—</span></td>;
                      const st = c.issue && !c.fixed ? c.issue.sev : c.fixed ? "ok" : s.checked ? "ok" : "draft";
                      const fp = flashProps(s, id);
                      return (
                        <td key={p.id}>
                          <div key={fp.key} className={`cell static s-${st}${fp.className}`}>
                            <span className="mono">{vnd(c.price)} · kho {c.stock}</span>
                            {c.issue && !c.fixed && <span className="cell-note">{c.issue.text}</span>}
                            {c.issue && !c.fixed && !s.busy && (
                              <button className="btn sm pri" type="button" onClick={() => { fix(s, id); s.flash[id] = Date.now(); human(`Chuyên viên duyệt: ${c.issue!.fix} (${r.name} · ${p.name}).`); }}>
                                {c.issue.fix}
                              </button>
                            )}
                            {c.fixed && <span className="cell-note ok">Đã sửa theo kế hoạch</span>}
                          </div>
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
          <section className="sec" aria-label="Banner chương trình">
            <h2 className="h2">Banner so với voucher thật</h2>
            {(() => {
              const fp = flashProps(s, "banner");
              return (
                <div key={fp.key} className={`bannercheck${fp.className}`}>
                  <div className="banner">
                    <span className="b-top">Siêu sale 10.10</span>
                    <span className="b-big">{s.banner === "fixed" ? "Giảm đến 30%" : "Giảm 50%"}</span>
                    <span className="b-sub">Tã quần Bông Nhỏ</span>
                  </div>
                  <div className="b-vs">
                    <div><div className="eyebrow">Chữ trên banner</div><b>{s.banner === "fixed" ? "Giảm đến 30%" : "Giảm 50%"}</b></div>
                    <div><div className="eyebrow">Voucher đang cài</div><b>30%, tối đa 60k</b></div>
                    {s.banner === "bad" && <p className="alert">Không khớp. Khách thấy 50% nhưng chỉ được giảm tối đa 60.000đ trên đơn 279.000đ.</p>}
                    {s.banner === "fixed" && <p className="okmsg">Đã khớp.</p>}
                    {s.banner === "bad" && !s.busy && (
                      <button className="btn sm pri" type="button" onClick={() => { s.banner = "fixed"; human('Chuyên viên duyệt: sửa banner thành "Giảm đến 30%".'); }}>Sửa banner thành “Giảm đến 30%”</button>
                    )}
                  </div>
                </div>
              );
            })()}
          </section>
          <AgentLog log={s.log} />
        </div>
      </div>
    </div>
  );
}

export default function Campaign() {
  return (
    <div className="module">
      <section className="panel" aria-label="Lịch sale">
        <div className="toolbar">
          <h2 className="h2">Lịch sale 3 sàn <small>Hạn đăng ký chương trình và ngày sale lớn</small></h2>
          <div className="counts">
            {PLATS.map((p) => {
              const w = WINDOWS[p.id][0];
              const left = daysLeft(w.to);
              return left >= 0 ? <span key={p.id} className={`count ${left <= 2 ? "s-bad" : "s-warn"}`}><i className="dot" />{p.name}: hạn ĐK 10.10 còn {left} ngày</span> : null;
            })}
          </div>
        </div>
        <SaleCalendar />
        <p className="note-line">Ngày và hạn đăng ký là mô phỏng. Khi làm thật, agent đọc từ thông báo chương trình của từng sàn và tự cập nhật lịch.</p>
        <h2 className="h2">Tiến độ 10.10 theo brand</h2>
        <div className="scroll-x">
          <table className="lg phases">
            <thead><tr><th>Brand</th>{PHASES.map((p) => <th key={p}>{p}</th>)}</tr></thead>
            <tbody>
              {BRANDS.map((b) => (
                <tr key={b.id}>
                  <th scope="row"><div className="rowh2"><b>{b.name}</b><small>{PLAN[b.id].note}</small></div></th>
                  {PLAN[b.id].phases.map((ph, i) => (
                    <td key={i}><span className={`phase ph-${ph}`}>{PH_LABEL[ph]}</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Guard />
    </div>
  );
}

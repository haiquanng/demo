import { useState } from "react";
import { baseState, useScenario, type Base, type Step } from "../lib/scenario";
import { BRANDS, pct } from "../data/common";
import { AgentLog, ScenarioBar, flashProps } from "../components/ui";

interface Notice { id: string; plat: string; date: string; raw: string; change?: { scope: string; kind: string; effective: string; from: string; to: string } }
const NOTICES: Notice[] = [
  { id: "A1", plat: "TikTok Shop", date: "24/09", raw: "Thông báo điều chỉnh phí: Từ ngày 15/10/2026, phí hoa hồng áp dụng cho ngành hàng Mẹ & Bé sẽ được điều chỉnh từ 5% lên 6,5% giá trị đơn hàng.", change: { scope: "Ngành Mẹ & Bé", kind: "Phí hoa hồng", effective: "15/10/2026", from: "5%", to: "6,5%" } },
  { id: "A2", plat: "Shopee", date: "25/09", raw: "Từ 01/11/2026, sản phẩm thuộc ngành hàng Mẹ & Bé bắt buộc điền thuộc tính “Độ tuổi phù hợp”. Sản phẩm thiếu thuộc tính sẽ bị ẩn khỏi kết quả tìm kiếm.", change: { scope: "Ngành Mẹ & Bé", kind: "Thuộc tính bắt buộc", effective: "01/11/2026", from: "Không bắt buộc", to: "Bắt buộc “Độ tuổi phù hợp”" } },
  { id: "A3", plat: "TikTok Shop", date: "25/09", raw: "Từ 01/11/2026, tiêu đề sản phẩm không được chứa emoji hoặc ký tự trang trí (ví dụ 【】, ★, 🔥).", change: { scope: "Mọi ngành", kind: "Luật tiêu đề", effective: "01/11/2026", from: "Cho phép", to: "Cấm emoji, ký tự trang trí" } },
];

/** Số listing bị ảnh hưởng theo brand và theo thay đổi. */
const IMPACT: Record<string, Record<string, { n: number; note: string }>> = {
  hv: { A1: { n: 0, note: "Không bán ngành Mẹ & Bé" }, A2: { n: 0, note: "Không bán ngành Mẹ & Bé" }, A3: { n: 3, note: "3 tiêu đề có “【Chính Hãng】”" } },
  ta: { A1: { n: 0, note: "Không bán ngành Mẹ & Bé" }, A2: { n: 0, note: "Không bán ngành Mẹ & Bé" }, A3: { n: 0, note: "Không có tiêu đề vi phạm" } },
  bn: { A1: { n: 38, note: "38/41 SKU. Nước giặt, tăm bông, gối chặn nằm ở ngành khác trên TikTok" }, A2: { n: 41, note: "41 SKU trên Shopee chưa có thuộc tính này" }, A3: { n: 0, note: "Không có tiêu đề vi phạm" } },
};

interface M { name: string; before: number; after: number; affected: boolean; action?: string }
const THRESH = 10;
const MARGINS: M[] = [
  { name: "Tăm bông 200 que", before: 32.0, after: 32.0, affected: false },
  { name: "Khăn sữa 10 cái", before: 24.5, after: 23.0, affected: true },
  { name: "Sữa tắm gội 500ml", before: 18.2, after: 16.7, affected: true },
  { name: "Kem hăm tã 50g", before: 15.1, after: 13.6, affected: true },
  { name: "Nước giặt sơ sinh 1L", before: 11.4, after: 11.4, affected: false },
  { name: "Tã quần size L", before: 11.2, after: 9.7, affected: true, action: "Tăng giá TikTok 2%: 329.000đ → 335.000đ" },
  { name: "Bình sữa 150ml", before: 10.8, after: 9.3, affected: true, action: "Tăng giá TikTok 2%: 259.000đ → 265.000đ" },
  { name: "Gối chặn cho bé", before: 9.6, after: 9.6, affected: false, action: "Đã dưới ngưỡng từ trước. Đề xuất bỏ khỏi voucher shop 10%" },
];
const AGE: { name: string; value: string; conf: number }[] = [
  { name: "Tã quần size L 52 miếng", value: "9–14kg, khoảng 12–24 tháng", conf: 0.93 },
  { name: "Bình sữa cổ rộng 150ml", value: "0–6 tháng", conf: 0.81 },
  { name: "Kem hăm tã 50g", value: "Từ sơ sinh", conf: 0.88 },
];

interface PS extends Base {
  read: boolean;
  scanned: boolean;
  computed: boolean;
  proposed: boolean;
  approved: string[];
}
const pinit = (): PS => ({ ...baseState(9 * 3600), read: false, scanned: false, computed: false, proposed: false, approved: [] });

const STEPS: Step<PS>[] = [
  {
    name: "Đọc thông báo",
    btn: "Đọc 3 thông báo mới",
    desc: <>Agent đọc thông báo của các sàn và chuyển mỗi thông báo thành <b>một thay đổi có cấu trúc</b>: phạm vi, loại, ngày hiệu lực, cũ và mới.</>,
    async run(s, io) {
      await io.say("Có 3 thông báo mới từ TikTok Shop và Shopee.");
      for (const n of NOTICES) await io.say(`${n.plat}: ${n.change!.kind} · ${n.change!.scope} · hiệu lực ${n.change!.effective}.`, "sub", 400);
      s.read = true;
    },
  },
  {
    name: "Rà mọi brand",
    btn: "Rà listing",
    desc: <>Agent rà toàn bộ listing của cả 3 brand. Phần khó là <b>xác định SKU nào thuộc ngành nào</b> trên cây danh mục của từng sàn.</>,
    async run(s, io) {
      await io.say("Rà 71 SKU × 3 sàn của 3 brand.");
      await io.say("Bông Nhỏ: 38/41 SKU nằm ở ngành Mẹ & Bé trên TikTok. Nước giặt, tăm bông, gối chặn nằm ở ngành khác nên không bị tăng phí.", "sub", 500);
      s.scanned = true;
      io.flash("bn");
      await io.say("Bông Nhỏ: 41 SKU trên Shopee thiếu “Độ tuổi phù hợp”. Hạ Vy: 3 tiêu đề TikTok có ký tự trang trí.", "warn");
    },
  },
  {
    name: "Tính ảnh hưởng phí",
    btn: "Tính lại biên lãi",
    desc: <>Với các SKU bị tăng phí, agent tính lại biên lãi trên TikTok Shop và so với ngưỡng tối thiểu 10% mà brand đặt.</>,
    async run(s, io) {
      await io.say("Tính lại biên lãi của Bông Nhỏ trên TikTok Shop với phí hoa hồng 6,5%.");
      s.computed = true;
      io.flash("chart");
      await io.say("Tã quần size L và Bình sữa 150ml rơi xuống dưới ngưỡng 10%.", "warn", 500);
    },
  },
  {
    name: "Đề xuất xử lý",
    btn: "Soạn đề xuất",
    desc: <>Agent soạn đề xuất cho từng SKU và điền sẵn thuộc tính còn thiếu. <b>Chuyên viên duyệt từng mục.</b></>,
    async run(s, io) {
      s.proposed = true;
      await io.say("Soạn 3 đề xuất giá và voucher, điền sẵn “Độ tuổi phù hợp” cho 41 SKU Shopee.");
      await io.say("Mục có độ tin cậy dưới 85% được đánh dấu để người kiểm tra.", "sub", 300);
    },
  },
];

function Dumbbell({ show }: { show: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 620, left = 170, right = 90, top = 28, rowH = 30;
  const H = top + MARGINS.length * rowH + 30;
  const max = 35;
  const x = (v: number) => left + (v / max) * (W - left - right);
  if (table)
    return (
      <>
        <div className="toolbar"><div className="legend" /><button className="btn sm" type="button" onClick={() => setTable(false)}>Xem biểu đồ</button></div>
        <div className="scroll-x">
          <table className="data">
            <thead><tr><th>SKU</th><th>Trước 15/10</th><th>Sau 15/10</th><th>Trạng thái</th></tr></thead>
            <tbody>{MARGINS.map((m) => <tr key={m.name}><td>{m.name}</td><td className="mono">{pct(m.before)}</td><td className="mono">{pct(m.after)}</td><td>{m.after < THRESH ? "Dưới ngưỡng" : m.affected ? "Giảm" : "Không đổi"}</td></tr>)}</tbody>
          </table>
        </div>
      </>
    );
  return (
    <>
      <div className="toolbar">
        <div className="legend">
          <span><i className="key before" />Trước 15/10 (phí 5%)</span>
          <span><i className="key after" />Sau 15/10 (phí 6,5%)</span>
          <span><i className="key thresh" />Ngưỡng tối thiểu {THRESH}%</span>
        </div>
        <button className="btn sm" type="button" onClick={() => setTable(true)}>Xem dạng bảng</button>
      </div>
      <div className="scroll-x">
        <svg className="dumbbell" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biên lãi trước và sau khi TikTok Shop tăng phí hoa hồng, theo từng SKU của Bông Nhỏ">
          {[0, 10, 20, 30].map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={top - 8} y2={H - 24} className="grid" />
              <text x={x(t)} y={H - 8} className="tick" textAnchor="middle">{t}%</text>
            </g>
          ))}
          <rect x={x(0)} y={top - 8} width={x(THRESH) - x(0)} height={H - 24 - (top - 8)} className="band-bad" />
          <line x1={x(THRESH)} x2={x(THRESH)} y1={top - 12} y2={H - 24} className="thresh" />
          <text x={x(THRESH) + 4} y={top - 14} className="mlabel">Ngưỡng {THRESH}%</text>
          {MARGINS.map((m, i) => {
            const y = top + i * rowH + rowH / 2;
            const below = m.after < THRESH;
            return (
              <g key={m.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="drow">
                <rect x={0} y={y - rowH / 2} width={W} height={rowH} className="hit" />
                <text x={left - 10} y={y + 4} textAnchor="end" className="rowlabel">{m.name}</text>
                {show && (
                  <>
                    {m.affected && <line x1={x(m.after)} x2={x(m.before)} y1={y} y2={y} className="conn" />}
                    <circle cx={x(m.before)} cy={y} r={5} className="d-before" />
                    {m.affected && <circle cx={x(m.after)} cy={y} r={5} className={below ? "d-bad" : "d-after"} />}
                    <text x={x(Math.max(m.before, m.after)) + 10} y={y + 4} className="vlabel">
                      {m.affected ? `${pct(m.after)}` : "không đổi"}{below ? " · dưới ngưỡng" : ""}
                    </text>
                  </>
                )}
                {hover === i && show && (
                  <g className="tip">
                    <rect x={left} y={y - 34} width={250} height={24} rx={5} />
                    <text x={left + 8} y={y - 18}>{m.name}: {pct(m.before)} → {pct(m.after)}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

export default function PolicyWatch() {
  const { s, steps, runNext, reset, human } = useScenario(pinit, STEPS, 4);
  const approve = (id: string, label: string) => {
    s.approved.push(id);
    human(`Chuyên viên duyệt: ${label}.`);
  };
  return (
    <div className="module">
      <ScenarioBar steps={steps} s={s} onRun={runNext} onReset={() => void reset(0)} />
      <div className="cols-2">
        <section className="panel" aria-label="Thông báo của sàn">
          <h2 className="h2">Thông báo mới <small>nội dung mô phỏng</small></h2>
          <ul className="notices">
            {NOTICES.map((n) => (
              <li key={n.id}>
                <header><span className="rid mono">{n.id}</span><span className="pl">{n.plat}</span><small className="muted">{n.date}</small></header>
                <p className="raw">{n.raw}</p>
                {s.read && n.change && (
                  <dl className="diff">
                    <div><dt>Phạm vi</dt><dd>{n.change.scope}</dd></div>
                    <div><dt>Loại</dt><dd>{n.change.kind}</dd></div>
                    <div><dt>Hiệu lực</dt><dd className="mono">{n.change.effective}</dd></div>
                    <div><dt>Thay đổi</dt><dd><s className="muted">{n.change.from}</s> → <b>{n.change.to}</b></dd></div>
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </section>
        <div className="panel stack">
          <section className="sec" aria-label="Đề xuất">
            <h2 className="h2">Đề xuất chờ duyệt</h2>
            {s.proposed ? (
              <>
                <ul className="proposals">
                  {MARGINS.filter((m) => m.action).map((m) => (
                    <li key={m.name}>
                      <div><b>{m.name}</b><p className="muted small">{m.action}</p></div>
                      {s.approved.includes(m.name) ? <span className="okmsg">Đã duyệt</span> : <button className="btn sm pri" type="button" disabled={s.busy} onClick={() => approve(m.name, m.action!)}>Duyệt</button>}
                    </li>
                  ))}
                </ul>
                <div className="eyebrow">Điền sẵn “Độ tuổi phù hợp” trên Shopee · 3/41 mẫu</div>
                <ul className="proposals">
                  {AGE.map((a) => (
                    <li key={a.name}>
                      <div><b>{a.name}</b><p className="small">{a.value} <span className={a.conf < 0.85 ? "conf" : "muted"}>· độ tin cậy {Math.round(a.conf * 100)}%{a.conf < 0.85 ? ", cần kiểm tra" : ""}</span></p></div>
                      {s.approved.includes(a.name) ? <span className="okmsg">Đã duyệt</span> : <button className="btn sm" type="button" disabled={s.busy} onClick={() => approve(a.name, `độ tuổi “${a.value}” cho ${a.name}`)}>Duyệt</button>}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="empty">Agent soạn đề xuất ở bước 4.</p>
            )}
          </section>
          <AgentLog log={s.log} />
        </div>
      </div>
      <div className="cols-even">
        <section className="panel" aria-label="Ảnh hưởng theo brand">
          <h2 className="h2">Listing bị ảnh hưởng</h2>
          <div className="scroll-x">
            <table className="lg impact">
              <thead><tr><th>Brand</th>{NOTICES.map((n) => <th key={n.id}>{n.id} · {n.change!.kind}</th>)}</tr></thead>
              <tbody>
                {BRANDS.map((b) => {
                  const fp = flashProps(s, b.id);
                  return (
                    <tr key={fp.key} className={fp.className}>
                      <th scope="row"><b>{b.name}</b></th>
                      {NOTICES.map((n) => {
                        const im = IMPACT[b.id][n.id];
                        return (
                          <td key={n.id}>
                            {s.scanned ? (
                              <div className={`cell static s-${im.n ? "warn" : "ok"}`}>
                                <span className="cell-top"><i className="dot" /><b>{im.n ? `${im.n} SKU` : "Không"}</b></span>
                                <span className="cell-note">{im.note}</span>
                              </div>
                            ) : <span className="muted">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel" aria-label="Biên lãi trước và sau">
          <h2 className="h2">Bông Nhỏ trên TikTok Shop <small>Biên lãi trước và sau khi tăng phí</small></h2>
          {s.computed ? (() => { const fp = flashProps(s, "chart"); return <div key={fp.key} className={fp.className.trim()}><Dumbbell show /></div>; })() : <p className="empty">Chạy bước 3 để tính lại biên lãi.</p>}
        </section>
      </div>
      <p className="note-line">Pain point: lần tăng hoa hồng đầu 2025 bị hơn 12.000 khiếu nại, sau đó lại thêm phí hạ tầng 3.000đ/đơn. Thông báo, mức phí và biên lãi ở đây là mô phỏng.</p>
    </div>
  );
}

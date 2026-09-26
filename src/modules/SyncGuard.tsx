import { baseState, useScenario, type Base, type Step } from "../lib/scenario";
import { PLATS, vnd, type PlatId } from "../data/common";
import { AgentLog, ScenarioBar, flashProps } from "../components/ui";

type CellState = "idle" | "pushed" | "ok" | "bad" | "warn" | "paused" | "fixed";
interface Cell { state: CellState; shown: string; note?: string; needsApproval?: boolean }
interface Change { id: string; product: string; field: string; before: string; after: string }
interface SS extends Base {
  parsed: boolean;
  cells: Record<string, Cell>;
  exposure: boolean;
}

const EMAIL = `Chào team, từ 01/10 bên mình đổi mấy điểm nhé:
1) Thớt gỗ nghiến 35cm tăng giá từ 320.000đ lên 350.000đ.
2) Khay gỗ decor chữ nhật dùng ảnh bao bì mới (file đính kèm).
3) Bộ đũa gỗ mun ngưng màu Đen, chỉ bán màu Nâu.
Cảm ơn team!`;

const CHANGES: Change[] = [
  { id: "C1", product: "Thớt gỗ nghiến 35cm", field: "Giá bán", before: "320.000đ", after: "350.000đ" },
  { id: "C2", product: "Khay gỗ decor chữ nhật", field: "Ảnh chính", before: "Bao bì 2025", after: "Bao bì 2026" },
  { id: "C3", product: "Bộ đũa gỗ mun", field: "Biến thể Đen", before: "Đang bán", after: "Ngừng bán" },
];
const COST = 190000;
const WRONG = 35000;
const RIGHT = 350000;

/** Kết quả mô phỏng khi agent đọc lại trang sản phẩm đang hiển thị trên từng sàn. */
const OBSERVED: Record<string, Cell> = {
  "C1|sp": { state: "ok", shown: "350.000đ" },
  "C1|tt": { state: "ok", shown: "350.000đ" },
  "C1|lz": { state: "bad", shown: "35.000đ", note: "Thiếu một số 0 khi nhập tay trên trang quản lý Lazada. Thấp hơn giá vốn 190.000đ." },
  "C2|sp": { state: "ok", shown: "Bao bì 2026" },
  "C2|tt": { state: "warn", shown: "Bao bì 2025", note: "Ảnh mới đang chờ TikTok duyệt. Agent tự kiểm tra lại sau 2 giờ." },
  "C2|lz": { state: "ok", shown: "Bao bì 2026" },
  "C3|sp": { state: "ok", shown: "Ngừng bán" },
  "C3|tt": { state: "ok", shown: "Ngừng bán" },
  "C3|lz": { state: "warn", shown: "Đang bán · còn 12", note: "Lệnh ẩn biến thể không áp dụng vì Lazada tách biến thể thành SKU riêng." },
};
const k = (c: string, p: PlatId) => c + "|" + p;

const init = (): SS => {
  const cells: Record<string, Cell> = {};
  CHANGES.forEach((c) => PLATS.forEach((p) => (cells[k(c.id, p.id)] = { state: "idle", shown: c.before })));
  return { ...baseState(14 * 3600 + 5 * 60), parsed: false, cells, exposure: false };
};

const STEPS: Step<SS>[] = [
  {
    name: "Nhận yêu cầu đổi",
    btn: "Đọc email của brand",
    desc: <>Brand Gỗ Tâm An gửi email báo đổi giá, đổi ảnh và ngừng một biến thể. Agent tách email thành <b>các thay đổi có cấu trúc</b>.</>,
    async run(s, io) {
      await io.say("Nhận email từ Gỗ Tâm An lúc 14:05.");
      await io.say("Tách ra 3 thay đổi: 1 giá, 1 ảnh, 1 biến thể. Hiệu lực từ 01/10.", "agent", 700);
      s.parsed = true;
      await io.say("Đối chiếu với dữ liệu gốc: cả 3 sản phẩm đang bán trên 3 sàn.", "ok");
    },
  },
  {
    name: "Cập nhật 3 sàn",
    btn: "Đẩy cập nhật",
    desc: <>Agent đẩy 3 thay đổi lên 3 sàn. Riêng Lazada, giá được một chuyên viên nhập tay vì sản phẩm đang chạy chương trình.</>,
    async run(s, io) {
      for (const p of PLATS) {
        await io.say(`[${p.name}] Gửi 3 cập nhật.`, "sub", 450);
        CHANGES.forEach((c) => (s.cells[k(c.id, p.id)].state = "pushed"));
        io.commit();
      }
      await io.say("Sàn đã nhận cả 9 cập nhật. Nhiều công cụ dừng ở đây. Agent sẽ đọc lại những gì khách đang thấy thật.", "ok");
    },
  },
  {
    name: "Kiểm tra hiển thị thật",
    btn: "Đọc lại trang sản phẩm",
    desc: <>Agent đọc lại <b>trang sản phẩm đang hiển thị</b> trên từng sàn và so với thay đổi mong muốn.</>,
    async run(s, io) {
      await io.say("Đọc lại 9 trang sản phẩm đang hiển thị.");
      for (const c of CHANGES)
        for (const p of PLATS) {
          await io.sleep(180);
          s.cells[k(c.id, p.id)] = { ...OBSERVED[k(c.id, p.id)] };
          io.commit();
        }
      io.flash(k("C1", "lz"));
      await io.say(`Lazada · Thớt gỗ nghiến đang hiển thị ${vnd(WRONG)} thay vì ${vnd(RIGHT)}. Thấp hơn giá vốn ${vnd(COST)}.`, "platform", 500);
      await io.say("TikTok Shop · Khay gỗ decor vẫn hiện ảnh cũ: ảnh mới đang chờ duyệt.", "warn", 300);
      await io.say("Lazada · Bộ đũa gỗ mun: biến thể Đen vẫn đang bán, còn 12 cái.", "warn", 300);
    },
  },
  {
    name: "Chặn rủi ro",
    btn: "Để agent xử lý",
    desc: <>Giá thấp hơn giá vốn nằm trong <b>quyền tự quyết</b> của agent: tạm ẩn ngay, không chờ người. Các sửa còn lại soạn sẵn, chờ chuyên viên duyệt.</>,
    async run(s, io) {
      s.cells[k("C1", "lz")] = { state: "paused", shown: "Tạm ẩn", note: `Agent tạm ẩn listing lúc này. Giá đúng ${vnd(RIGHT)} đã soạn sẵn, chờ duyệt.`, needsApproval: true };
      io.flash(k("C1", "lz"));
      await io.say("Tạm ẩn Thớt gỗ nghiến trên Lazada theo quyền tự quyết: giá hiển thị thấp hơn giá vốn.", "agent", 500);
      s.exposure = true;
      await io.say(`Trong 42 phút giá sai, Lazada ghi nhận 3 đơn ở ${vnd(WRONG)}. Lỗ ước tính ${vnd(3 * (COST - WRONG))}. Chuyển cho chuyên viên quyết định cách xử lý 3 đơn này.`, "warn");
      s.cells[k("C3", "lz")] = { ...s.cells[k("C3", "lz")], needsApproval: true, note: "Đã soạn lệnh ngừng bán SKU riêng của biến thể Đen trên Lazada. Chờ duyệt." };
      await io.say("Soạn lệnh ngừng bán SKU biến thể Đen trên Lazada. Chờ duyệt.", "agent", 300);
      await io.say("Hẹn kiểm tra lại ảnh trên TikTok Shop lúc 16:15.", "sub", 300);
    },
  },
  {
    name: "Kiểm tra lại",
    btn: "Kiểm tra lại",
    desc: <>Sau khi chuyên viên duyệt, agent đọc lại lần nữa. Chỉ khi <b>khách thấy đúng</b> thì thay đổi mới được tính là xong.</>,
    async run(s, io) {
      for (const id of ["C1", "C3"]) {
        const c = s.cells[k(id, "lz")];
        if (c.needsApproval) {
          await io.say(`Chuyên viên duyệt sửa ${id === "C1" ? "giá" : "biến thể"} trên Lazada.`, "human", 300);
          applyApproved(s, id);
        }
      }
      await io.say("Đọc lại 9 trang sản phẩm.", "agent", 500);
      s.clock += 2 * 3600;
      s.cells[k("C2", "tt")] = { state: "ok", shown: "Bao bì 2026", note: "TikTok đã duyệt ảnh mới." };
      io.flash(k("C2", "tt"));
      await io.say("TikTok Shop đã duyệt ảnh mới cho Khay gỗ decor.", "platform", 300);
      await io.say("9/9 thay đổi hiển thị đúng trên cả 3 sàn.", "ok");
    },
  },
];

function applyApproved(s: SS, id: string) {
  if (id === "C1") s.cells[k("C1", "lz")] = { state: "fixed", shown: "350.000đ", note: "Đã sửa giá và mở bán lại." };
  if (id === "C3") s.cells[k("C3", "lz")] = { state: "fixed", shown: "Ngừng bán", note: "Đã ngừng SKU biến thể Đen." };
}

const LABEL: Record<CellState, string> = { idle: "Chưa đổi", pushed: "Đã gửi, chưa kiểm", ok: "Hiển thị đúng", bad: "Sai", warn: "Chưa khớp", paused: "Agent đã tạm ẩn", fixed: "Đã sửa, hiển thị đúng" };

function PriceLine({ shown }: { shown: number }) {
  // Trục giá từ 0 đến 400.000đ, đánh dấu giá vốn, giá đúng và giá đang hiển thị.
  const W = 460, pad = 16, max = 400000;
  const x = (v: number) => pad + (v / max) * (W - pad * 2);
  const marks = [
    { v: COST, label: "Giá vốn", cls: "m-muted", y: 12 },
    { v: RIGHT, label: "Giá đúng", cls: "m-ok", y: 12 },
    { v: shown, label: "Đang hiển thị", cls: shown < COST ? "m-bad" : "m-ok", y: 60 },
  ];
  return (
    <div className="scroll-x">
      <svg className="priceline" viewBox={`0 0 ${W} 84`} role="img" aria-label={`Giá đang hiển thị ${vnd(shown)}, giá vốn ${vnd(COST)}, giá đúng ${vnd(RIGHT)}`}>
        <rect x={x(0)} y={38} width={x(COST) - x(0)} height={6} rx={3} className="band-bad" />
        <line x1={x(0)} x2={x(max)} y1={41} y2={41} className="axis" />
        {[0, 100000, 200000, 300000, 400000].map((t) => (
          <text key={t} x={x(t)} y={56} className="tick" textAnchor="middle">{t / 1000}k</text>
        ))}
        {marks.map((m) => (
          <g key={m.label} className={m.cls}>
            <line x1={x(m.v)} x2={x(m.v)} y1={m.y === 12 ? 18 : 44} y2={m.y === 12 ? 38 : 64} className="stem" />
            <circle cx={x(m.v)} cy={41} r={5} />
            <text x={x(m.v)} y={m.y === 12 ? 12 : 78} textAnchor={m.v > 330000 ? "end" : m.v < 60000 ? "start" : "middle"} className="mlabel">
              {m.label} {vnd(m.v)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function SyncGuard() {
  const { s, steps, runNext, reset, human } = useScenario(init, STEPS, 3);
  const cells = Object.values(s.cells);
  const count = (st: CellState[]) => cells.filter((c) => st.includes(c.state)).length;
  const lzPrice = s.cells[k("C1", "lz")];
  const shownPrice = lzPrice.state === "bad" ? WRONG : lzPrice.state === "fixed" || lzPrice.state === "ok" ? RIGHT : null;

  const approve = (id: string) => {
    applyApproved(s, id);
    s.flash[k(id, "lz")] = Date.now();
    human(`Chuyên viên duyệt sửa ${id === "C1" ? "giá Thớt gỗ nghiến" : "biến thể Đen của Bộ đũa gỗ mun"} trên Lazada.`);
  };

  return (
    <div className="module">
      <ScenarioBar steps={steps} s={s} onRun={runNext} onReset={() => void reset(0)} />
      <div className="cols-3">
        <section className="panel" aria-label="Yêu cầu từ brand">
          <div className="eyebrow">Email từ Gỗ Tâm An · 14:05</div>
          <pre className="email">{EMAIL}</pre>
          <h2 className="h2">Thay đổi agent tách ra</h2>
          {s.parsed ? (
            <ul className="changes">
              {CHANGES.map((c) => (
                <li key={c.id}>
                  <span className="rid mono">{c.id}</span>
                  <div><b>{c.product}</b><div className="muted small">{c.field}: <s>{c.before}</s> → <b className="ink">{c.after}</b></div></div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Chạy bước 1 để agent đọc email.</p>
          )}
        </section>

        <section className="panel" aria-label="Đối chiếu hiển thị thật">
          <div className="toolbar">
            <div className="counts">
              <span className="count s-bad"><i className="dot" />Sai <b>{count(["bad"])}</b></span>
              <span className="count s-warn"><i className="dot" />Chưa khớp <b>{count(["warn", "paused"])}</b></span>
              <span className="count s-ok"><i className="dot" />Hiển thị đúng <b>{count(["ok", "fixed"])}</b></span>
              <span className="count"><i className="dot" />Chưa kiểm <b>{count(["idle", "pushed"])}</b></span>
            </div>
          </div>
          <div className="scroll-x">
            <table className="lg">
              <thead><tr><th>Thay đổi mong muốn</th>{PLATS.map((p) => <th key={p.id} scope="col">{p.name}</th>)}</tr></thead>
              <tbody>
                {CHANGES.map((c) => (
                  <tr key={c.id}>
                    <th scope="row"><div className="rowh2"><b>{c.product}</b><small>{c.field} → {c.after}</small></div></th>
                    {PLATS.map((p) => {
                      const id = k(c.id, p.id);
                      const cell = s.cells[id];
                      const fp = flashProps(s, id);
                      const cls = cell.state === "fixed" ? "ok" : cell.state === "paused" ? "warn" : cell.state === "pushed" || cell.state === "idle" ? "draft" : cell.state;
                      return (
                        <td key={p.id}>
                          <div key={fp.key} className={`cell static s-${cls}${fp.className}`}>
                            <span className="cell-top"><i className="dot" /><b>{LABEL[cell.state]}</b></span>
                            <span className="shown mono">{cell.state === "bad" ? <><s className="muted">{c.after}</s> {cell.shown}</> : cell.shown}</span>
                            {cell.note && <span className="cell-note">{cell.note}</span>}
                            {cell.needsApproval && !s.busy && (
                              <button className="btn sm pri" type="button" onClick={() => approve(c.id)}>Duyệt sửa</button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sec">
            <div className="eyebrow">Thớt gỗ nghiến trên Lazada · khách đang thấy giá nào</div>
            {shownPrice ? <PriceLine shown={shownPrice} /> : <p className="empty">{lzPrice.state === "paused" ? "Listing đang tạm ẩn, khách không đặt được." : "Chưa đọc lại trang sản phẩm."}</p>}
            {s.exposure && <p className="alert">3 đơn đã đặt ở giá {vnd(WRONG)} trước khi agent tạm ẩn. Lỗ ước tính {vnd(3 * (COST - WRONG))}. Chuyên viên quyết định cách xử lý.</p>}
          </div>
        </section>

        <div className="panel stack">
          <section className="sec" aria-label="Quyền tự quyết của agent">
            <h2 className="h2">Quyền tự quyết</h2>
            <div className="policy">
              <div><div className="eyebrow">Agent tự làm ngay</div><ul><li>Tạm ẩn listing khi giá hiển thị thấp hơn giá vốn</li><li>Đọc lại trang sản phẩm sau mỗi cập nhật</li><li>Hẹn kiểm tra lại khi sàn còn đang duyệt</li></ul></div>
              <div><div className="eyebrow">Phải chờ người duyệt</div><ul><li>Đổi giá, đổi biến thể, đổi nội dung</li><li>Xử lý đơn đã đặt ở giá sai</li></ul></div>
            </div>
            <p className="muted small">Enabler cấu hình danh sách này cho từng brand.</p>
          </section>
          <AgentLog log={s.log} />
        </div>
      </div>
      <p className="note-line">Pain point: một shop đặt nhầm giá có nguy cơ mất gần 2 tỉ (Thanh Niên). Email, sản phẩm và số đơn ở đây là mô phỏng.</p>
    </div>
  );
}


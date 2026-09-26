import { BRANDS, type BrandId } from "../data/common";

export type ModuleId = "launch" | "sync" | "campaign" | "koc" | "policy";
export const MODULES: { id: ModuleId; name: string; job: string }[] = [
  { id: "launch", name: "Launch", job: "Đưa catalog brand mới lên 3 sàn" },
  { id: "sync", name: "Sync Guard", job: "Đổi giá, ảnh, biến thể và kiểm tra khách thấy gì" },
  { id: "campaign", name: "Campaign", job: "Lịch sale và soát trước giờ mở bán" },
  { id: "koc", name: "KOC Claim Watch", job: "So lời KOC nói với sự thật gốc" },
  { id: "policy", name: "Policy Watch", job: "Sàn đổi luật hoặc phí, rà lại mọi brand" },
];

type Sev = "bad" | "warn" | "ok" | "none";
const TODO: { sev: Sev; module: ModuleId; brand: BrandId | "all"; text: string }[] = [
  { sev: "bad", module: "sync", brand: "ta", text: "Lazada hiển thị Thớt gỗ nghiến 35.000đ, thấp hơn giá vốn. Agent đã tạm ẩn, chờ duyệt giá đúng." },
  { sev: "bad", module: "campaign", brand: "bn", text: "Flash sale 10.10 trên Shopee: Nước giặt sơ sinh cài 15.900đ thay vì 159.000đ." },
  { sev: "bad", module: "koc", brand: "bn", text: "@meBimSaiGon nói sữa tắm “chữa khỏi chàm sữa”, video có 182 nghìn lượt xem." },
  { sev: "warn", module: "launch", brand: "hv", text: "Còn 11 listing vi phạm hoặc cần xem trước ngày mở bán 03/10." },
  { sev: "warn", module: "campaign", brand: "all", text: "Hạn đăng ký 10.10 trên Lazada còn 1 ngày (27/09)." },
  { sev: "warn", module: "policy", brand: "bn", text: "TikTok Shop tăng phí Mẹ & Bé từ 15/10: 2 SKU rơi dưới ngưỡng lãi 10%." },
];

const HEALTH: Record<BrandId, Record<ModuleId, [Sev, string]>> = {
  hv: { launch: ["warn", "11 listing cần xử lý"], sync: ["none", "Chưa mở bán"], campaign: ["none", "Không chạy 10.10"], koc: ["none", "Chưa có video"], policy: ["warn", "3 tiêu đề TikTok"] },
  ta: { launch: ["ok", "Đã lên sàn"], sync: ["bad", "1 giá sai trên Lazada"], campaign: ["warn", "2 SKU chưa đủ điều kiện"], koc: ["bad", "1 video nói sai"], policy: ["ok", "Không ảnh hưởng"] },
  bn: { launch: ["ok", "Đã lên sàn"], sync: ["ok", "Khớp"], campaign: ["bad", "4 chỗ chưa khớp kế hoạch"], koc: ["bad", "1 video nói sai"], policy: ["warn", "2 SKU dưới ngưỡng lãi"] },
};
const SEV_LABEL: Record<Sev, string> = { bad: "Khẩn", warn: "Cần xem", ok: "Ổn", none: "Không áp dụng" };

export const MODULE_ALERTS: Record<ModuleId, number> = TODO.reduce(
  (acc, t) => ({ ...acc, [t.module]: acc[t.module] + 1 }),
  { launch: 0, sync: 0, campaign: 0, koc: 0, policy: 0 } as Record<ModuleId, number>,
);

export default function Overview({ go }: { go(id: ModuleId): void }) {
  const bname = (b: BrandId | "all") => (b === "all" ? "Mọi brand" : BRANDS.find((x) => x.id === b)!.name);
  return (
    <div className="module">
      <div className="cols-2 wide-left">
        <section className="panel" aria-label="Việc cần xử lý hôm nay">
          <h2 className="h2">Việc cần xử lý hôm nay <small>{TODO.length} việc, xếp theo mức độ</small></h2>
          <ul className="todo">
            {TODO.map((t, i) => (
              <li key={i} className={`s-${t.sev}`}>
                <span className={`sev s-${t.sev}`}><i className="dot" />{SEV_LABEL[t.sev]}</span>
                <div>
                  <p>{t.text}</p>
                  <small className="muted">{bname(t.brand)}</small>
                </div>
                <button className="btn sm" type="button" onClick={() => go(t.module)}>
                  Mở {MODULES.find((m) => m.id === t.module)!.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel" aria-label="Các brand đang vận hành">
          <h2 className="h2">Brand đang vận hành</h2>
          <ul className="brands">
            {BRANDS.map((b) => (
              <li key={b.id}>
                <b>{b.name}</b>
                <span className="muted small">{b.industry} · {b.skus} SKU</span>
                <span className="small">{b.stage}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="panel" aria-label="Sức khỏe theo brand và module">
        <h2 className="h2">Sức khỏe theo brand và module</h2>
        <div className="scroll-x">
          <table className="lg health">
            <thead>
              <tr><th>Brand</th>{MODULES.map((m) => <th key={m.id} scope="col"><button type="button" className="linklike" onClick={() => go(m.id)}>{m.name}</button></th>)}</tr>
            </thead>
            <tbody>
              {BRANDS.map((b) => (
                <tr key={b.id}>
                  <th scope="row"><b>{b.name}</b></th>
                  {MODULES.map((m) => {
                    const [sev, text] = HEALTH[b.id][m.id];
                    return (
                      <td key={m.id}>
                        <div className={`cell static s-${sev === "none" ? "draft" : sev}`}>
                          <span className="cell-top"><i className="dot" /><b>{SEV_LABEL[sev]}</b></span>
                          <span className="cell-note">{text}</span>
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
    </div>
  );
}

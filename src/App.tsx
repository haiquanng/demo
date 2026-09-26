import { useEffect, useState } from "react";
import Overview, { MODULES, MODULE_ALERTS, type ModuleId } from "./modules/Overview";
import Launch from "./modules/Launch";
import SyncGuard from "./modules/SyncGuard";
import Campaign from "./modules/Campaign";
import KocWatch from "./modules/KocWatch";
import PolicyWatch from "./modules/PolicyWatch";

type View = "tong-quan" | ModuleId;
const VIEWS: View[] = ["tong-quan", ...MODULES.map((m) => m.id)];
const fromHash = (): View => {
  const h = location.hash.slice(1) as View;
  return VIEWS.includes(h) ? h : "tong-quan";
};

export default function App() {
  const [view, setView] = useState<View>(fromHash);
  useEffect(() => {
    const on = () => setView(fromHash());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const go = (v: View) => {
    if (location.hash.slice(1) !== v) location.hash = v;
    setView(v);
    scrollTo({ top: 0 });
  };
  const cur = MODULES.find((m) => m.id === view);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <h1>Lên<span>Sàn</span></h1>
          <p>Agent vận hành đa sàn cho enabler: Shopee, TikTok Shop, Lazada</p>
        </div>
        <div className="ctx">
          <span className="chip">3 brand · 71 SKU</span>
          <span className="chip">Hôm nay <b className="mono">26/09/2026</b></span>
          <span className="chip note">Bản mô phỏng: brand, dữ liệu, luật và phản hồi của sàn đều là ví dụ. Agent chưa gọi model thật.</span>
        </div>
      </header>

      <div className="frame">
        <nav className="side" aria-label="Module">
          <button type="button" className={view === "tong-quan" ? "on" : ""} aria-current={view === "tong-quan" ? "page" : undefined} onClick={() => go("tong-quan")}>
            <b>Tổng quan</b>
            <small>Việc cần xử lý hôm nay</small>
          </button>
          <div className="side-label">Vòng đời listing</div>
          {MODULES.map((m) => (
            <button key={m.id} type="button" className={view === m.id ? "on" : ""} aria-current={view === m.id ? "page" : undefined} onClick={() => go(m.id)}>
              <b>{m.name}{MODULE_ALERTS[m.id] > 0 && <span className="badge">{MODULE_ALERTS[m.id]}</span>}</b>
              <small>{m.job}</small>
            </button>
          ))}
        </nav>

        <main className="content">
          <div className="view-head">
            <h2>{cur ? cur.name : "Tổng quan"}</h2>
            <p>{cur ? cur.job : "Những gì agent phát hiện trên 3 brand, 3 sàn"}</p>
          </div>
          {/* Giữ các module luôn được gắn để không mất trạng thái kịch bản khi chuyển qua lại. */}
          <div hidden={view !== "tong-quan"}><Overview go={go} /></div>
          <div hidden={view !== "launch"}><Launch /></div>
          <div hidden={view !== "sync"}><SyncGuard /></div>
          <div hidden={view !== "campaign"}><Campaign /></div>
          <div hidden={view !== "koc"}><KocWatch /></div>
          <div hidden={view !== "policy"}><PolicyWatch /></div>
        </main>
      </div>
    </div>
  );
}

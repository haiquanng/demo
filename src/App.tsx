import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import LaunchStudio from "./launch/LaunchStudio";
import SyncGuard from "./modules/SyncGuard";
import Campaign from "./modules/Campaign";
import KocWatch from "./modules/KocWatch";
import PolicyWatch from "./modules/PolicyWatch";

const LATER = [
  { id: "sync", name: "Sync Guard", job: "Đổi giá, ảnh, biến thể và kiểm tra khách thấy gì" },
  { id: "campaign", name: "Campaign", job: "Lịch sale và soát trước giờ mở bán" },
  { id: "koc", name: "KOC Claim Watch", job: "So lời KOC nói với sự thật gốc" },
  { id: "policy", name: "Policy Watch", job: "Sàn đổi luật hoặc phí, rà lại mọi brand" },
] as const;
type View = "len-san" | (typeof LATER)[number]["id"];
const VIEWS: View[] = ["len-san", ...LATER.map((m) => m.id)];
const fromHash = (): View => {
  const h = location.hash.slice(1) as View;
  return VIEWS.includes(h) ? h : "len-san";
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
  const later = LATER.find((m) => m.id === view);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto grid max-w-[1560px] gap-4 px-4 pb-10 pt-4 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex items-baseline gap-3">
            <h1 className="m-0 font-display text-[28px] leading-none tracking-tight">
              Lên<span className="text-brand">Sàn</span>
            </h1>
            <p className="hidden text-[13px] text-ink-soft md:block">Agent vận hành đa sàn cho enabler</p>
          </div>
          <nav aria-label="Trang" className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
            <NavBtn on={view === "len-san"} onClick={() => go("len-san")}>Lên sàn</NavBtn>
            <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
            <span className="hidden whitespace-nowrap px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft sm:block">Sau khi lên sàn</span>
            {LATER.map((m) => (
              <NavBtn key={m.id} on={view === m.id} onClick={() => go(m.id)}>{m.name}</NavBtn>
            ))}
          </nav>
        </header>

        {later && (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="m-0 font-display text-[22px]">{later.name}</h2>
              <p className="text-[13.5px] text-ink-soft">{later.job}</p>
            </div>
            <span className="rounded-full border border-dashed border-line px-3 py-1 text-[12px] text-ink-soft">Mô phỏng theo kịch bản, chưa gọi AI thật</span>
          </div>
        )}

        {/* Giữ các trang luôn được gắn để không mất trạng thái khi chuyển qua lại. */}
        <div hidden={view !== "len-san"}><LaunchStudio /></div>
        <div hidden={view !== "sync"}><SyncGuard /></div>
        <div hidden={view !== "campaign"}><Campaign /></div>
        <div hidden={view !== "koc"}><KocWatch /></div>
        <div hidden={view !== "policy"}><PolicyWatch /></div>
      </div>
      <Toaster theme="light" position="top-right" richColors />
    </TooltipProvider>
  );
}

function NavBtn({ on, onClick, children }: { on: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? "bg-ink text-white" : "text-ink-soft hover:bg-surface-2 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

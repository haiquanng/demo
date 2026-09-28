import { Navigate, NavLink, useLocation } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import LaunchStudio from "./launch/LaunchStudio";
import SyncGuard from "./modules/SyncGuard";
import Campaign from "./modules/Campaign";
import KocWatch from "./modules/KocWatch";
import PolicyWatch from "./modules/PolicyWatch";

const LATER = [
  { path: "/sync-guard", name: "Sync Guard", job: "Đổi giá, ảnh, biến thể và kiểm tra khách thấy gì", el: <SyncGuard /> },
  { path: "/campaign", name: "Campaign", job: "Lịch sale và soát trước giờ mở bán", el: <Campaign /> },
  { path: "/koc-claim", name: "KOC Claim Watch", job: "So lời KOC nói với sự thật gốc", el: <KocWatch /> },
  { path: "/policy-watch", name: "Policy Watch", job: "Sàn đổi luật hoặc phí, rà lại mọi brand", el: <PolicyWatch /> },
];
const HOME = "/len-san";
const PATHS = [HOME, ...LATER.map((m) => m.path)];

export default function App() {
  const { pathname, search } = useLocation();
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!PATHS.includes(path)) return <Navigate to={HOME + search} replace />;
  const later = LATER.find((m) => m.path === path);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto grid max-w-[1560px] gap-4 px-4 pb-10 pt-4 sm:px-6 *:min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <NavLink to={HOME} className="flex items-baseline gap-3 no-underline text-ink">
            <h1 className="m-0 font-display text-[28px] leading-none tracking-tight">
              Lên<span className="text-brand">Sàn</span>
            </h1>
            <p className="hidden text-[13px] text-ink-soft md:block">Agent vận hành đa sàn cho enabler</p>
          </NavLink>
          <nav aria-label="Trang" className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
            <Tab to={HOME}>Lên sàn</Tab>
            <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
            <span className="hidden whitespace-nowrap px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft sm:block">Sau khi lên sàn</span>
            {LATER.map((m) => (
              <Tab key={m.path} to={m.path}>{m.name}</Tab>
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

        {/* Mỗi trang có đường dẫn riêng nhưng vẫn luôn được gắn, nên chuyển tab không mất dữ liệu đang làm dở. */}
        <div hidden={path !== HOME}><LaunchStudio /></div>
        {LATER.map((m) => (
          <div key={m.path} hidden={path !== m.path}>{m.el}</div>
        ))}
      </div>
      <Toaster theme="light" position="top-right" richColors />
    </TooltipProvider>
  );
}

function Tab({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium no-underline transition-colors ${isActive ? "bg-ink text-white" : "text-ink-soft hover:bg-surface-2 hover:text-ink"}`
      }
    >
      {children}
    </NavLink>
  );
}

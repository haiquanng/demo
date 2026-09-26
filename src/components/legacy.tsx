import { useEffect, useRef, type ReactNode } from "react";
import type { Base, LogEntry, Step } from "../lib/scenario";

export function ScenarioBar<S extends Base>(props: {
  steps: Step<S>[];
  s: S;
  onRun(): void;
  onReset(): void;
  children?: ReactNode;
}) {
  const { steps, s } = props;
  const cur = steps[s.step];
  return (
    <section className="scen" aria-label="Kịch bản demo">
      <ol className="steps">
        {steps.map((st, i) => (
          <li key={st.name} className={i < s.step ? "done" : i === s.step ? "cur" : ""}>
            <span className="n">{i < s.step ? "✓" : i + 1}</span>
            {st.name}
          </li>
        ))}
      </ol>
      <div className="scen-row">
        <p className="scen-desc">
          {cur ? (
            <>
              <b>Bước {s.step + 1}.</b> {cur.desc}
            </>
          ) : (
            <>
              <b>Xong kịch bản.</b> Bấm vào các ô để xem chi tiết, hoặc làm lại từ đầu để trình bày lần nữa.
            </>
          )}
        </p>
        <div className="btns">
          <button className="btn pri" type="button" disabled={!cur || s.busy} onClick={props.onRun}>
            {cur ? `Chạy bước ${s.step + 1}: ${cur.btn}` : `Đã chạy hết ${steps.length} bước`}
          </button>
          <button className="btn" type="button" disabled={s.busy} onClick={props.onReset}>
            Làm lại từ đầu
          </button>
        </div>
      </div>
      {props.children}
    </section>
  );
}

export function AgentLog({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log.length]);
  return (
    <section className="sec" aria-label="Nhật ký agent">
      <h2 className="h2">Nhật ký agent</h2>
      <ul className="log" ref={ref}>
        {log.length ? (
          log.map((e, i) => (
            <li key={i} className={`k-${e.kind}`}>
              <time>{e.t}</time>
              <span>{e.msg}</span>
            </li>
          ))
        ) : (
          <li className="log-empty">Chưa có hoạt động.</li>
        )}
      </ul>
    </section>
  );
}

export function Sheet(props: { open: boolean; onClose(): void; eyebrow: string; title: string; badge?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!props.open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);
  if (!props.open) return null;
  return (
    <>
      <div className="backdrop" onClick={props.onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="sheet-head">
          <div>
            <div className="eyebrow">{props.eyebrow}</div>
            <h2 id="sheet-title">{props.title}</h2>
          </div>
          <div className="btns center">
            {props.badge}
            <button ref={closeRef} className="btn" type="button" onClick={props.onClose}>
              Đóng
            </button>
          </div>
        </div>
        <div className="sheet-body">{props.children}</div>
        {props.footer && <div className="sheet-foot">{props.footer}</div>}
      </aside>
    </>
  );
}

export function Ph({ hue, short, sticker, big }: { hue: number; short: string; sticker?: string | null; big?: boolean }) {
  return (
    <div className={`ph${big ? " big" : ""}`} style={{ ["--h" as string]: hue }}>
      <span>{short}</span>
      {sticker && <em className="stk">{sticker}</em>}
    </div>
  );
}

export function StatusPill({ cls, children }: { cls: string; children: ReactNode }) {
  return (
    <span className={`pill s-${cls}`}>
      <i className="dot" />
      {children}
    </span>
  );
}

/** Key để phần tử được gắn lại (và chạy hiệu ứng nháy) mỗi lần agent đánh dấu nó. */
export function flashProps(s: Base, key: string) {
  const f = s.flash[key];
  return { key: key + ":" + (f ?? 0), className: f ? " flash" : "" };
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="note-line">{children}</p>;
}

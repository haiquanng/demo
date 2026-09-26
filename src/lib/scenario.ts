import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type LogKind = "agent" | "sub" | "warn" | "ok" | "platform" | "human";
export interface LogEntry { t: string; msg: string; kind: LogKind }

/** Trạng thái chung của mọi kịch bản. Mỗi module mở rộng thêm dữ liệu riêng. */
export interface Base {
  step: number;
  busy: boolean;
  log: LogEntry[];
  clock: number; // giây kể từ 00:00, giờ mô phỏng
  flash: Record<string, number>;
}

export interface IO {
  say(msg: string, kind?: LogKind, ms?: number): Promise<void>;
  sleep(ms: number): Promise<void>;
  commit(): void;
  flash(key: string): void;
}

export interface Step<S> {
  name: string;
  btn: string;
  desc: ReactNode;
  run(s: S, io: IO): Promise<void>;
}

class Cancelled extends Error {}

export const fmtClock = (t: number) =>
  [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((x) => String(x).padStart(2, "0")).join(":");

export function baseState(clock: number): Base {
  return { step: 0, busy: false, log: [], clock, flash: {} };
}

const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Chạy kịch bản từng bước trên một object trạng thái có thể sửa trực tiếp.
 * Mỗi lần commit() thì render lại. Làm lại từ đầu sẽ huỷ lượt chạy đang dở.
 */
export function useScenario<S extends Base>(init: () => S, steps: Step<S>[], prerun = 0) {
  const ref = useRef<S | null>(null);
  const token = useRef(0);
  const [, setTick] = useState(0);
  const commit = useCallback(() => setTick((t) => t + 1), []);
  if (!ref.current) ref.current = init();

  const makeIO = useCallback(
    (s: S, instant: boolean): IO => {
      const mine = token.current;
      const guard = () => {
        if (mine !== token.current) throw new Cancelled();
      };
      const sleep = (ms: number) =>
        instant ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, reduced ? Math.min(ms, 120) : ms)).then(guard);
      return {
        sleep,
        commit: () => {
          guard();
          commit();
        },
        flash: (k) => {
          if (!instant) s.flash[k] = Date.now();
        },
        async say(msg, kind = "agent", ms = 420) {
          await sleep(ms);
          guard();
          s.clock += 2 + Math.floor(Math.random() * 8);
          s.log.push({ t: fmtClock(s.clock), msg, kind });
          commit();
        },
      };
    },
    [commit],
  );

  const runNext = useCallback(async () => {
    const s = ref.current!;
    if (s.busy || s.step >= steps.length) return;
    s.busy = true;
    commit();
    try {
      await steps[s.step].run(s, makeIO(s, false));
      s.step++;
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
      return;
    } finally {
      if (ref.current === s) s.busy = false;
    }
    commit();
  }, [steps, makeIO, commit]);

  const reset = useCallback(
    async (toStep = 0) => {
      token.current++;
      const s = init();
      ref.current = s;
      const io = makeIO(s, true);
      for (let i = 0; i < toStep; i++) {
        await steps[i].run(s, io);
        s.step++;
      }
      commit();
    },
    [init, steps, makeIO, commit],
  );

  /** Ghi một thao tác của người dùng vào nhật ký. */
  const human = useCallback(
    (msg: string, kind: LogKind = "human") => {
      const s = ref.current!;
      s.clock += 3 + Math.floor(Math.random() * 5);
      s.log.push({ t: fmtClock(s.clock), msg, kind });
      commit();
    },
    [commit],
  );

  const didPrerun = useRef(false);
  useEffect(() => {
    if (didPrerun.current || !prerun) return;
    didPrerun.current = true;
    void reset(prerun);
  }, [prerun, reset]);

  return { s: ref.current, steps, runNext, reset, commit, human };
}

import { useEffect, useRef, type RefObject } from "react";

export interface LiquidTarget {
  top: number;
  height: number;
}

const STIFFNESS = 340;
const DAMPING = 26;
const TRAIL_STIFFNESS = 130;
const TRAIL_DAMPING = 18;
const MAX_STRETCH = 0.26;

interface Axis {
  pos: number | null;
  vel: number;
}

// Springs a main pill + laggier trailing blob toward `target`, mutating styles
// directly on the refs (no React state) to stay fully compositor-driven per frame.
export function useLiquidIndicator(
  mainRef: RefObject<HTMLElement | null>,
  trailRef: RefObject<HTMLElement | null>,
  target: LiquidTarget | null,
) {
  const main = useRef<Axis>({ pos: null, vel: 0 });
  const trail = useRef<Axis>({ pos: null, vel: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const mainEl = mainRef.current;
    const trailEl = trailRef.current;
    if (!mainEl || !trailEl) return;

    if (!target) {
      mainEl.style.opacity = "0";
      trailEl.style.opacity = "0";
      main.current.pos = null;
      trail.current.pos = null;
      return;
    }

    mainEl.style.opacity = "1";
    trailEl.style.opacity = "1";
    mainEl.style.height = `${target.height}px`;
    trailEl.style.height = `${Math.max(target.height - 10, 10)}px`;

    if (main.current.pos === null) {
      main.current = { pos: target.top, vel: 0 };
      trail.current = { pos: target.top, vel: 0 };
      mainEl.style.transform = `translateY(${target.top}px) scaleY(1)`;
      trailEl.style.transform = `translateY(${target.top + 5}px) scaleY(1)`;
      return;
    }

    let last = performance.now();

    function step(now: number) {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      const m = main.current;
      const tr = trail.current;
      const t = target!.top;

      const mAcc = (t - m.pos!) * STIFFNESS - m.vel * DAMPING;
      m.vel += mAcc * dt;
      m.pos = m.pos! + m.vel * dt;

      const trAcc = (t - tr.pos!) * TRAIL_STIFFNESS - tr.vel * TRAIL_DAMPING;
      tr.vel += trAcc * dt;
      tr.pos = tr.pos! + tr.vel * dt;

      const mainStretch = 1 + Math.min(Math.abs(m.vel) / 2200, MAX_STRETCH);
      const trailStretch = 1 + Math.min(Math.abs(tr.vel) / 1800, MAX_STRETCH);

      if (mainEl) {
        mainEl.style.transformOrigin = m.vel >= 0 ? "top" : "bottom";
        mainEl.style.transform = `translateY(${m.pos}px) scaleY(${mainStretch})`;
      }
      if (trailEl) {
        trailEl.style.transformOrigin = tr.vel >= 0 ? "top" : "bottom";
        trailEl.style.transform = `translateY(${tr.pos! + 5}px) scaleY(${trailStretch})`;
      }

      const settled =
        Math.abs(t - m.pos!) < 0.3 &&
        Math.abs(m.vel) < 0.3 &&
        Math.abs(t - tr.pos!) < 0.3 &&
        Math.abs(tr.vel) < 0.3;

      if (settled) {
        m.pos = t;
        m.vel = 0;
        tr.pos = t;
        tr.vel = 0;
        if (mainEl) {
          mainEl.style.transformOrigin = "center";
          mainEl.style.transform = `translateY(${t}px) scaleY(1)`;
        }
        if (trailEl) {
          trailEl.style.transformOrigin = "center";
          trailEl.style.transform = `translateY(${t + 5}px) scaleY(1)`;
        }
        rafRef.current = null;
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.top, target?.height]);
}

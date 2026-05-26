import { useEffect, useRef, useState } from 'react';

/**
 * Bobbing senoidal global compartido por todos los agentes "working".
 * 5Hz, +-2px. Usa requestAnimationFrame para suavidad y throttle a ~50ms
 * para no saturar React con re-renders en cada frame.
 */
const FREQ_HZ = 5;
const AMPL_PX = 2;
const REFRESH_MS = 50; // ~20fps de re-render, suficiente para senoide

export function useAgentsBobbing(): number {
  const [phase, setPhase] = useState(0);
  const lastUpdate = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      if (t - lastUpdate.current >= REFRESH_MS) {
        lastUpdate.current = t;
        const sec = t / 1000;
        setPhase(Math.sin(sec * 2 * Math.PI * FREQ_HZ) * AMPL_PX);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return phase;
}

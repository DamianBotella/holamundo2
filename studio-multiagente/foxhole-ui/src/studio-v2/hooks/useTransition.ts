import { useCallback, useState } from 'react';

export type TransitionPhase = 'idle' | 'fading-out' | 'fading-in';

/**
 * Fade out (150ms) -> swap -> fade in (150ms). Total 300ms.
 * El swap ocurre entre las dos fases via la callback `swapFn`.
 */
export function useTransition(durationMs = 150) {
  const [phase, setPhase] = useState<TransitionPhase>('idle');

  const startTransition = useCallback(
    async (swapFn: () => void) => {
      setPhase('fading-out');
      await new Promise(r => setTimeout(r, durationMs));
      swapFn();
      setPhase('fading-in');
      await new Promise(r => setTimeout(r, 20)); // pequeno respiro para que React aplique el nuevo room
      // Mantener fading-in unos ms y luego idle
      await new Promise(r => setTimeout(r, durationMs));
      setPhase('idle');
    },
    [durationMs],
  );

  return { phase, startTransition };
}

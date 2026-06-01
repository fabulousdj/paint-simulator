export type MaskHistory = {
  past: Uint8ClampedArray[];
  future: Uint8ClampedArray[];
};

export const emptyMaskHistory = (): MaskHistory => ({ past: [], future: [] });

export function areMaskBuffersEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function pushMaskHistory(
  history: MaskHistory,
  current: Uint8ClampedArray,
  next: Uint8ClampedArray
): MaskHistory {
  if (areMaskBuffersEqual(current, next)) return history;
  return {
    past: [...history.past, new Uint8ClampedArray(current)],
    future: [],
  };
}

export function undoMaskHistory(
  history: MaskHistory,
  current: Uint8ClampedArray
): { history: MaskHistory; mask: Uint8ClampedArray | null } {
  const previous = history.past[history.past.length - 1];
  if (!previous) return { history, mask: null };

  return {
    mask: new Uint8ClampedArray(previous),
    history: {
      past: history.past.slice(0, -1),
      future: [new Uint8ClampedArray(current), ...history.future],
    },
  };
}

export function redoMaskHistory(
  history: MaskHistory,
  current: Uint8ClampedArray
): { history: MaskHistory; mask: Uint8ClampedArray | null } {
  const next = history.future[0];
  if (!next) return { history, mask: null };

  return {
    mask: new Uint8ClampedArray(next),
    history: {
      past: [...history.past, new Uint8ClampedArray(current)],
      future: history.future.slice(1),
    },
  };
}

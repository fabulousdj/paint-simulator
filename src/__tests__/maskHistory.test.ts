import { describe, expect, it } from "vitest";
import {
  areMaskBuffersEqual,
  emptyMaskHistory,
  pushMaskHistory,
  redoMaskHistory,
  undoMaskHistory,
} from "../utils/maskHistory";

describe("mask history", () => {
  it("compares mask buffers by content", () => {
    expect(areMaskBuffersEqual(new Uint8ClampedArray([0, 1]), new Uint8ClampedArray([0, 1]))).toBe(true);
    expect(areMaskBuffersEqual(new Uint8ClampedArray([0, 1]), new Uint8ClampedArray([0, 2]))).toBe(false);
  });

  it("pushes previous state and clears redo", () => {
    const history = { past: [new Uint8ClampedArray([9])], future: [new Uint8ClampedArray([7])] };
    const next = pushMaskHistory(history, new Uint8ClampedArray([0]), new Uint8ClampedArray([1]));

    expect(next.past.map((mask) => Array.from(mask))).toEqual([[9], [0]]);
    expect(next.future).toEqual([]);
  });

  it("does not push identical states", () => {
    const history = emptyMaskHistory();
    const next = pushMaskHistory(history, new Uint8ClampedArray([1]), new Uint8ClampedArray([1]));

    expect(next).toBe(history);
  });

  it("undoes and redoes mask edits", () => {
    let history = pushMaskHistory(emptyMaskHistory(), new Uint8ClampedArray([0]), new Uint8ClampedArray([1]));

    const undone = undoMaskHistory(history, new Uint8ClampedArray([1]));
    expect(Array.from(undone.mask ?? [])).toEqual([0]);
    expect(undone.history.past).toHaveLength(0);
    expect(undone.history.future.map((mask) => Array.from(mask))).toEqual([[1]]);

    history = undone.history;
    const redone = redoMaskHistory(history, new Uint8ClampedArray([0]));
    expect(Array.from(redone.mask ?? [])).toEqual([1]);
    expect(redone.history.past.map((mask) => Array.from(mask))).toEqual([[0]]);
    expect(redone.history.future).toHaveLength(0);
  });
});

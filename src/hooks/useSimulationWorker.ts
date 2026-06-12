import { useEffect, useRef, useState, type Dispatch } from "react";
import type { SessionAction } from "../state/session";
import type { ProjectSession } from "../types/session";
import { hasMaskCoverage } from "../utils/mask";
import type { SimulationMetadata, SimulationWorkerRequest, SimulationWorkerResponse } from "../utils/simulation";

type SimulationStatus = "idle" | "blocked" | "running" | "complete" | "error";

export type SimulationWorkerState = {
  status: SimulationStatus;
  requestId: number;
  runKey: number;
  metadata: SimulationMetadata | null;
};

type UseSimulationWorkerOptions = {
  debounceMs?: number;
  enabled?: boolean;
  preserveResultWhenBlocked?: boolean;
  runKey?: number;
};

function maskToAlpha(mask: ProjectSession["maskImageData"]): Uint8ClampedArray | null {
  if (!mask) return null;
  if (mask instanceof Uint8ClampedArray) return mask;

  const alpha = new Uint8ClampedArray(mask.width * mask.height);
  for (let i = 0; i < alpha.length; i += 1) {
    alpha[i] = mask.data[i * 4 + 3] ?? 0;
  }
  return alpha;
}

export function isSimulationReady(session: ProjectSession): boolean {
  const mask = maskToAlpha(session.maskImageData);
  return Boolean(
    session.image.sourceImageData &&
      session.image.workingWidth > 0 &&
      session.image.workingHeight > 0 &&
      session.paintA &&
      session.paintB &&
      hasMaskCoverage(mask)
  );
}

export function useSimulationWorker(
  session: ProjectSession,
  dispatch: Dispatch<SessionAction>,
  { debounceMs = 150, enabled = true, preserveResultWhenBlocked = false, runKey = 0 }: UseSimulationWorkerOptions = {}
): SimulationWorkerState {
  const workerRef = useRef<Worker | null>(null);
  const latestRequestId = useRef(0);
  const [state, setState] = useState<SimulationWorkerState>({ status: "idle", requestId: 0, runKey: 0, metadata: null });

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sourceImageData = session.image.sourceImageData;
    const mask = maskToAlpha(session.maskImageData);

    if (!sourceImageData || !session.paintA || !session.paintB || !mask || !hasMaskCoverage(mask)) {
      latestRequestId.current += 1;
      setState({ status: sourceImageData ? "blocked" : "idle", requestId: latestRequestId.current, runKey, metadata: null });
      if (session.resultImageData && !preserveResultWhenBlocked) dispatch({ type: "CLEAR_RESULT_BUFFER" });
      return;
    }

    if (!enabled) {
      latestRequestId.current += 1;
      return;
    }

    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setState((current) => ({ status: "running", requestId, runKey, metadata: current.metadata }));

    const timer = window.setTimeout(() => {
      workerRef.current?.terminate();
      const worker = new Worker(new URL("../workers/simulationWorker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;

      const releaseWorker = () => {
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };

      worker.onmessage = (event: MessageEvent<SimulationWorkerResponse>) => {
        const isLatest = event.data.requestId === latestRequestId.current;
        releaseWorker();
        if (!isLatest) return;
        dispatch({ type: "SET_RESULT_BUFFER", buffer: event.data.imageData.data });
        setState({ status: "complete", requestId, runKey, metadata: event.data.metadata });
      };

      worker.onerror = () => {
        const isLatest = requestId === latestRequestId.current;
        releaseWorker();
        if (!isLatest) return;
        setState({ status: "error", requestId, runKey, metadata: null });
      };

      const transferMask = new Uint8ClampedArray(mask);

      const request: SimulationWorkerRequest = {
        requestId,
        sourceImageData,
        mask: transferMask,
        paintA: session.paintA!,
        paintB: session.paintB!,
        mode: session.simulationMode,
      };

      worker.postMessage(request, [transferMask.buffer]);
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [debounceMs, dispatch, enabled, preserveResultWhenBlocked, runKey, session.image.sourceImageData, session.maskImageData, session.paintA, session.paintB, session.simulationMode]);

  return state;
}

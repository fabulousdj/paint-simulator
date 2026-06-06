import { useEffect, useRef, useState, type Dispatch } from "react";
import type { SessionAction } from "../state/session";
import type { ProjectSession } from "../types/session";
import { hasMaskCoverage } from "../utils/mask";
import type { SimulationMetadata, SimulationWorkerRequest, SimulationWorkerResponse } from "../utils/simulation";

type SimulationStatus = "idle" | "blocked" | "running" | "complete" | "error";

export type SimulationWorkerState = {
  status: SimulationStatus;
  metadata: SimulationMetadata | null;
};

type UseSimulationWorkerOptions = {
  debounceMs?: number;
  enabled?: boolean;
  preserveResultWhenBlocked?: boolean;
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
  { debounceMs = 150, enabled = true, preserveResultWhenBlocked = false }: UseSimulationWorkerOptions = {}
): SimulationWorkerState {
  const workerRef = useRef<Worker | null>(null);
  const latestRequestId = useRef(0);
  const [state, setState] = useState<SimulationWorkerState>({ status: "idle", metadata: null });

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
      setState({ status: sourceImageData ? "blocked" : "idle", metadata: null });
      if (session.resultImageData && !preserveResultWhenBlocked) dispatch({ type: "CLEAR_RESULT_BUFFER" });
      return;
    }

    if (!enabled) {
      latestRequestId.current += 1;
      return;
    }

    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setState((current) => ({ status: "running", metadata: current.metadata }));

    const timer = window.setTimeout(() => {
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL("../workers/simulationWorker.ts", import.meta.url), {
          type: "module",
        });
      }

      workerRef.current.onmessage = (event: MessageEvent<SimulationWorkerResponse>) => {
        if (event.data.requestId !== latestRequestId.current) return;
        dispatch({ type: "SET_RESULT_BUFFER", buffer: event.data.imageData.data });
        setState({ status: "complete", metadata: event.data.metadata });
      };

      workerRef.current.onerror = () => {
        if (requestId !== latestRequestId.current) return;
        setState({ status: "error", metadata: null });
      };

      const request: SimulationWorkerRequest = {
        requestId,
        sourceImageData,
        mask: new Uint8ClampedArray(mask),
        paintA: session.paintA!,
        paintB: session.paintB!,
        mode: session.simulationMode,
      };

      workerRef.current.postMessage(request);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, dispatch, enabled, preserveResultWhenBlocked, session.image.sourceImageData, session.maskImageData, session.paintA, session.paintB, session.resultImageData, session.simulationMode]);

  return state;
}

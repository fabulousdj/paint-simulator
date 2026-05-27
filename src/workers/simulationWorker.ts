import { simulatePaintTransfer, type SimulationWorkerRequest, type SimulationWorkerResponse } from "../utils/simulation";

self.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  const { requestId, ...input } = event.data;
  const result = simulatePaintTransfer(input);
  const response: SimulationWorkerResponse = {
    requestId,
    ...result,
  };

  self.postMessage(response);
};

export {};

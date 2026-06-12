import { simulatePaintTransfer, type SimulationWorkerRequest, type SimulationWorkerResponse } from "../utils/simulation";

type WorkerGlobal = {
  onmessage: ((event: MessageEvent<SimulationWorkerRequest>) => void) | null;
  postMessage: (message: SimulationWorkerResponse, transfer: Transferable[]) => void;
};

const workerSelf = self as unknown as WorkerGlobal;

workerSelf.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  const { requestId, ...input } = event.data;
  const result = simulatePaintTransfer(input);
  const response: SimulationWorkerResponse = {
    requestId,
    ...result,
  };

  workerSelf.postMessage(response, [response.imageData.data.buffer as ArrayBuffer]);
};

export {};

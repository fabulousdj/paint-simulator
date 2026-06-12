import {
  tensorMaskToAlpha,
  type WallSegmentationWorkerRequest,
  type WallSegmentationWorkerResponse,
} from "../utils/wallSegmentation";

const SAM_MODEL_ID = "Xenova/slimsam-77-uniform";

type SamRuntime = {
  model: any;
  processor: any;
  RawImage: new (data: Uint8ClampedArray, width: number, height: number, channels: 1 | 2 | 3 | 4) => any;
};

type WorkerGlobal = {
  onmessage: ((event: MessageEvent<WallSegmentationWorkerRequest>) => void) | null;
  postMessage: (message: WallSegmentationWorkerResponse, transfer?: Transferable[]) => void;
};

const workerSelf = self as unknown as WorkerGlobal;

let runtimePromise: Promise<SamRuntime> | null = null;

function loadSamRuntime(): Promise<SamRuntime> {
  runtimePromise ??= import("@huggingface/transformers").then(async ({ SamModel, AutoProcessor, RawImage }) => {
    const [model, processor] = await Promise.all([
      SamModel.from_pretrained(SAM_MODEL_ID),
      AutoProcessor.from_pretrained(SAM_MODEL_ID),
    ]);
    return { model, processor, RawImage };
  });
  return runtimePromise;
}

async function selectWallMaskFromPoint({ sourceImageData, point }: WallSegmentationWorkerRequest) {
  const { model, processor, RawImage } = await loadSamRuntime();
  const rawImage = new RawImage(new Uint8ClampedArray(sourceImageData.data), sourceImageData.width, sourceImageData.height, 4).rgb();
  const inputPoints = [[[Math.round(point.x), Math.round(point.y)]]];
  const inputs = await processor(rawImage, { input_points: inputPoints });
  const outputs = await model(inputs);
  const masks = await processor.post_process_masks(
    outputs.pred_masks,
    inputs.original_sizes,
    inputs.reshaped_input_sizes
  );
  const maskTensor = Array.isArray(masks) ? masks[0] : masks;
  return tensorMaskToAlpha(maskTensor, sourceImageData.width, sourceImageData.height, outputs.iou_scores);
}

workerSelf.onmessage = (event: MessageEvent<WallSegmentationWorkerRequest>) => {
  void (async () => {
    try {
      const mask = await selectWallMaskFromPoint(event.data);
      workerSelf.postMessage({ requestId: event.data.requestId, mask }, [mask.buffer as ArrayBuffer]);
    } catch (error) {
      workerSelf.postMessage({
        requestId: event.data.requestId,
        error: error instanceof Error ? error.message : "Wall selection failed.",
      });
    }
  })();
};

export {};

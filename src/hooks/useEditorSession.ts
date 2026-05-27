import { useReducer, useCallback, useRef, useEffect, type RefObject } from "react";
import { sessionReducer, type SessionAction } from "../state/session";
import { defaultSession, type ProjectSession } from "../types/session";
import { containDimensions, workingDimensions } from "../utils/coords";

let objUrlRef: string | null = null;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const UNSUPPORTED_IMAGE_TYPE_MESSAGE = "Use a JPG, PNG, or WebP room photo.";
export const DECODE_IMAGE_ERROR_MESSAGE =
  "This photo could not be decoded. Choose a different JPG, PNG, or WebP.";

export function isAcceptedImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number]);
}

export function decodeImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    objUrlRef = url;

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      objUrlRef = null;
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

export function revokeObjectUrl(): void {
  if (objUrlRef) {
    URL.revokeObjectURL(objUrlRef);
    objUrlRef = null;
  }
}

export function createWorkingImage(img: HTMLImageElement, maxSize: number = 2048) {
  const { w, h } = workingDimensions(img.naturalWidth, img.naturalHeight, maxSize);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  return { canvas, imageData, width: w, height: h };
}

type SessionState = {
  session: ProjectSession;
  containerW: number;
  containerH: number;
  displayW: number;
  displayH: number;
  isLoading: boolean;
  error: string | null;
  fileName: string | null;
};

const initialState: SessionState = {
  session: defaultSession,
  containerW: 0,
  containerH: 0,
  displayW: 0,
  displayH: 0,
  isLoading: false,
  error: null,
  fileName: null,
};

type EditorSessionAction =
  | SessionAction
  | { type: "SET_CONTAINER_SIZE"; w: number; h: number }
  | { type: "IMAGE_LOAD_START"; fileName: string }
  | { type: "IMAGE_LOAD_ERROR"; error: string }
  | { type: "IMAGE_LOAD_COMPLETE" };

function reducer(state: SessionState, action: EditorSessionAction): SessionState {
  if (action.type === "SET_CONTAINER_SIZE") {
    if (!state.session.image.sourceImageData) {
      return { ...state, containerW: action.w, containerH: action.h };
    }

    const { w, h } = containDimensions(
      state.session.image.workingWidth,
      state.session.image.workingHeight,
      action.w,
      action.h
    );

    return {
      ...state,
      containerW: action.w,
      containerH: action.h,
      displayW: w,
      displayH: h,
      session: {
        ...state.session,
        image: {
          ...state.session.image,
          displayWidth: w,
          displayHeight: h,
        },
      },
    };
  }

  if (action.type === "IMAGE_LOAD_START") {
    return { ...state, isLoading: true, error: null, fileName: action.fileName };
  }

  if (action.type === "IMAGE_LOAD_ERROR") {
    return { ...state, isLoading: false, error: action.error };
  }

  if (action.type === "IMAGE_LOAD_COMPLETE") {
    return { ...state, isLoading: false, error: null };
  }

  const newSession = sessionReducer(state.session, action);
  let containerW = state.containerW;
  let containerH = state.containerH;
  let displayW = state.displayW;
  let displayH = state.displayH;

  if (action.type === "SET_IMAGE" || action.type === "CLEAR_IMAGE" || action.type === "RESET_SESSION") {
    if (newSession.image.sourceImageData) {
      const { w, h } = containDimensions(
        newSession.image.workingWidth,
        newSession.image.workingHeight,
        containerW,
        containerH
      );
      displayW = w;
      displayH = h;
    } else {
      displayW = 0;
      displayH = 0;
      if (action.type === "CLEAR_IMAGE" || action.type === "RESET_SESSION") {
        return {
          ...state,
          session: newSession,
          displayW,
          displayH,
          isLoading: false,
          error: null,
          fileName: null,
        };
      }
    }
  }

  const newSessionWithDisplay = {
    ...newSession,
    image: {
      ...newSession.image,
      displayWidth: displayW,
      displayHeight: displayH,
    },
  };

  return {
    ...state,
    session: newSessionWithDisplay,
    containerW,
    containerH,
    displayW,
    displayH,
  };
}

export function useEditorSession(containerRef: RefObject<HTMLDivElement | null>) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!containerRef?.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        dispatch({ type: "SET_CONTAINER_SIZE", w: Math.floor(width), h: Math.floor(height) });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { session } = state;
    canvas.width = state.displayW || 1;
    canvas.height = state.displayH || 1;

    if (session.image.sourceImageData && state.displayW > 0) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = session.image.workingWidth || 1;
      tempCanvas.height = session.image.workingHeight || 1;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.putImageData(session.image.sourceImageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0, state.displayW, state.displayH);
      }
    }
  }, [state.displayW, state.displayH, state.session.image.sourceImageData]);

  const loadImageFile = useCallback(async (file: File) => {
    if (!isAcceptedImageFile(file)) {
      dispatch({ type: "IMAGE_LOAD_ERROR", error: UNSUPPORTED_IMAGE_TYPE_MESSAGE });
      return;
    }

    dispatch({ type: "IMAGE_LOAD_START", fileName: file.name });

    try {
      const img = await decodeImage(file);
      revokeObjectUrl();
      const { imageData, width, height } = createWorkingImage(img);

      dispatch({
        type: "SET_IMAGE",
        source: img,
        imageData,
        workingW: width,
        workingH: height,
      });
      dispatch({ type: "IMAGE_LOAD_COMPLETE" });
    } catch {
      revokeObjectUrl();
      dispatch({ type: "IMAGE_LOAD_ERROR", error: DECODE_IMAGE_ERROR_MESSAGE });
    }
  }, []);

  return {
    state,
    dispatch,
    canvasRef,
    loadImageFile,
    upload: {
      isLoading: state.isLoading,
      error: state.error,
      fileName: state.fileName,
    },
  };
}

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkingImage,
  DECODE_IMAGE_ERROR_MESSAGE,
  isAcceptedImageFile,
  UNSUPPORTED_IMAGE_TYPE_MESSAGE,
} from "../hooks/useEditorSession";

describe("image upload file validation", () => {
  it("accepts JPG, PNG, and WebP", () => {
    expect(isAcceptedImageFile(new File([""], "room.jpg", { type: "image/jpeg" }))).toBe(true);
    expect(isAcceptedImageFile(new File([""], "room.png", { type: "image/png" }))).toBe(true);
    expect(isAcceptedImageFile(new File([""], "room.webp", { type: "image/webp" }))).toBe(true);
  });

  it("rejects unsupported file types with user-facing copy", () => {
    expect(isAcceptedImageFile(new File([""], "room.gif", { type: "image/gif" }))).toBe(false);
    expect(UNSUPPORTED_IMAGE_TYPE_MESSAGE).toBe("Use a JPG, PNG, or WebP room photo.");
    expect(DECODE_IMAGE_ERROR_MESSAGE).toBe(
      "This photo could not be decoded. Choose a different JPG, PNG, or WebP."
    );
  });
});

describe("createWorkingImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bounds working image data at 2048px on the longest side", () => {
    const imageData = {
      width: 2048,
      height: 1024,
      data: new Uint8ClampedArray(2048 * 1024 * 4),
      colorSpace: "srgb",
    } as ImageData;
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => imageData);

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      getImageData,
    } as unknown as CanvasRenderingContext2D);

    const img = {
      naturalWidth: 4096,
      naturalHeight: 2048,
    } as HTMLImageElement;

    const working = createWorkingImage(img);

    expect(working.width).toBe(2048);
    expect(working.height).toBe(1024);
    expect(working.imageData).toBe(imageData);
    expect(drawImage).toHaveBeenCalledWith(img, 0, 0, 2048, 1024);
    expect(getImageData).toHaveBeenCalledWith(0, 0, 2048, 1024);
  });
});

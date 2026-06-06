import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkingImage,
  DECODE_IMAGE_ERROR_MESSAGE,
  IMAGE_UPLOAD_ACCEPT,
  isHeicImageFile,
  isAcceptedImageFile,
  prepareImageFileForDecode,
  UNSUPPORTED_IMAGE_TYPE_MESSAGE,
} from "../hooks/useEditorSession";

describe("image upload file validation", () => {
  it("accepts JPG, PNG, WebP, HEIC, and HEIF", () => {
    expect(isAcceptedImageFile(new File([""], "room.jpg", { type: "image/jpeg" }))).toBe(true);
    expect(isAcceptedImageFile(new File([""], "room.png", { type: "image/png" }))).toBe(true);
    expect(isAcceptedImageFile(new File([""], "room.webp", { type: "image/webp" }))).toBe(true);
    expect(isAcceptedImageFile(new File([""], "room.heic", { type: "image/heic" }))).toBe(true);
    expect(isAcceptedImageFile(new File([""], "room.HEIF", { type: "" }))).toBe(true);
  });

  it("detects HEIC and HEIF files by MIME type or extension", () => {
    expect(isHeicImageFile(new File([""], "room.jpeg", { type: "image/heic" }))).toBe(true);
    expect(isHeicImageFile(new File([""], "room.heif", { type: "" }))).toBe(true);
    expect(isHeicImageFile(new File([""], "room.jpg", { type: "image/jpeg" }))).toBe(false);
  });

  it("rejects unsupported file types with user-facing copy", () => {
    expect(isAcceptedImageFile(new File([""], "room.gif", { type: "image/gif" }))).toBe(false);
    expect(IMAGE_UPLOAD_ACCEPT).toContain(".heic");
    expect(UNSUPPORTED_IMAGE_TYPE_MESSAGE).toBe("Use a JPG, PNG, WebP, HEIC, or HEIF room photo.");
    expect(DECODE_IMAGE_ERROR_MESSAGE).toBe(
      "This photo could not be decoded or converted. Choose a different JPG, PNG, WebP, HEIC, or HEIF."
    );
  });

  it("converts HEIC files to PNG before decode", async () => {
    const output = new Blob(["png"], { type: "image/png" });
    const converter = vi.fn(async () => output);
    const file = new File(["heic"], "room.heic", { type: "image/heic", lastModified: 123 });

    const converted = await prepareImageFileForDecode(file, converter);

    expect(converter).toHaveBeenCalledWith({ blob: file, type: "image/png" });
    expect(converted.name).toBe("room.png");
    expect(converted.type).toBe("image/png");
    expect(converted.lastModified).toBe(123);
  });

  it("leaves browser-decodable image files unchanged", async () => {
    const file = new File(["jpg"], "room.jpg", { type: "image/jpeg" });

    await expect(prepareImageFileForDecode(file)).resolves.toBe(file);
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

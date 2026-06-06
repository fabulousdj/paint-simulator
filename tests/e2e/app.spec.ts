import { test, expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createRoomPng(width = 64, height = 48): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const index = row + 1 + x * 4;
      const isWall = x < width * 0.72;
      raw[index] = isWall ? 198 + Math.floor(y / 8) : 88;
      raw[index + 1] = isWall ? 202 + Math.floor(x / 16) : 70;
      raw[index + 2] = isWall ? 200 : 58;
      raw[index + 3] = 255;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function fillPaint(sectionName: string, hex: string, lrv: string, page: Page) {
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: sectionName }) });
  await section.getByLabel("Hex color").fill(hex);
  await section.getByLabel("Manual LRV").fill(lrv);
}

test("app loads and shows ChromaMatch title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ChromaMatch/);
  await expect(page.getByRole("heading", { name: "ChromaMatch" })).toBeVisible();
  await expect(page.getByText("Upload room photo")).toBeVisible();
  await expect(page.getByText("JPG, PNG, WebP, HEIC, or HEIF - photos stay in your browser")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current paint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Target paint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dev samples" })).toBeVisible();
  await expect(page.getByText("Local browser processing: enabled. Photos are not uploaded.")).toBeVisible();
  await expect(page.getByLabel("Simulation mode")).toHaveValue("lab-delta-d50");
  await expect(page.getByText(/Simulation status: idle/)).toBeVisible();
  await expect(page.getByText("Upload a room photo.")).toBeVisible();
});

test("MVP workflow uploads, masks, simulates, compares, and exports", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "room.png",
    mimeType: "image/png",
    buffer: createRoomPng(),
  });

  await expect(page.getByText("room.png")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PNG" })).toBeDisabled();

  await fillPaint("Current paint", "#C8CCC8", "58", page);
  await fillPaint("Target paint", "#7589A3", "32", page);
  await expect(page.getByText("Add a non-empty wall mask.")).toBeVisible();

  const canvas = page.getByLabel("Uploaded room photo canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("Canvas was not measurable.");

  await page.getByRole("button", { name: "Brush" }).click();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByText(/Simulation status: complete/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Ready to simulate with LAB D50 delta transfer.")).toBeVisible();
  await page.getByRole("button", { name: "After" }).click();
  await page.getByRole("button", { name: "Before" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^chromamatch-preview-\d{8}-\d{6}\.png$/);
  expect(await download.path()).toBeTruthy();
});

test("optional local HEIC fixture uploads successfully", async ({ page }) => {
  const heicFixturePath = process.env.CHROMAMATCH_HEIC_FIXTURE_PATH;
  test.skip(!heicFixturePath || !existsSync(heicFixturePath), "Set CHROMAMATCH_HEIC_FIXTURE_PATH to a local HEIC file.");

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(heicFixturePath!);

  await expect(page.getByText(/Photo loaded\. Working image prepared/)).toBeVisible({ timeout: 20_000 });
});

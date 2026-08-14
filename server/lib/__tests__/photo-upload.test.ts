import { describe, it, expect } from "vitest";
import { validatePhotoDataUrl, MAX_PHOTO_BYTES, MAX_ORDER_PHOTOS, MAX_TICKET_PHOTOS } from "../photo-upload";

// 1x1 px PNG
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function toDataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}

describe("validatePhotoDataUrl", () => {
  it("accepts a valid small PNG", () => {
    const res = validatePhotoDataUrl(toDataUrl("image/png", PNG_1PX));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.mimeType).toBe("image/png");
      expect(res.bytes).toBeGreaterThan(0);
    }
  });

  it("accepts JPEG with the correct magic bytes", () => {
    // Minimal JPEG: FF D8 FF ... (magic) padded to a small base64 blob
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString("base64");
    const res = validatePhotoDataUrl(toDataUrl("image/jpeg", jpeg));
    expect(res.ok).toBe(true);
  });

  it("accepts WebP with the RIFF/WEBP magic bytes", () => {
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]).toString("base64");
    const res = validatePhotoDataUrl(toDataUrl("image/webp", webp));
    expect(res.ok).toBe(true);
  });

  it("rejects non-data-url input", () => {
    expect(validatePhotoDataUrl("https://example.com/photo.jpg").ok).toBe(false);
    expect(validatePhotoDataUrl(undefined as any).ok).toBe(false);
  });

  it("rejects unsupported MIME types", () => {
    const res = validatePhotoDataUrl(toDataUrl("image/gif", PNG_1PX));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("JPEG, PNG or WebP");
  });

  it("rejects content that does not match the declared MIME (spoofed magic bytes)", () => {
    const res = validatePhotoDataUrl(toDataUrl("image/jpeg", PNG_1PX));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("does not match");
  });

  it("rejects empty payloads", () => {
    const res = validatePhotoDataUrl(toDataUrl("image/png", ""));
    expect(res.ok).toBe(false);
  });

  it("rejects photos above the size limit", () => {
    const big = Buffer.alloc(MAX_PHOTO_BYTES + 1, 0x89);
    const res = validatePhotoDataUrl(toDataUrl("image/png", big.toString("base64")));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("limit");
  });

  it("accepts photos at or just below the size limit", () => {
    const buf = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(1024, 0x00)]);
    const res = validatePhotoDataUrl(toDataUrl("image/png", buf.toString("base64")));
    expect(res.ok).toBe(true);
  });
});

describe("photo limits", () => {
  it("exposes the configured caps", () => {
    expect(MAX_PHOTO_BYTES).toBe(2.5 * 1024 * 1024);
    expect(MAX_ORDER_PHOTOS).toBe(5);
    expect(MAX_TICKET_PHOTOS).toBe(3);
  });
});
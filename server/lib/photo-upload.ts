export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedPhotoType = (typeof ALLOWED_PHOTO_TYPES)[number];

export const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;
export const MAX_ORDER_PHOTOS = 5;
export const MAX_TICKET_PHOTOS = 3;

export type PhotoValidationResult =
  | { ok: true; mimeType: AllowedPhotoType; bytes: number }
  | { ok: false; error: string };

function matchesMagic(mimeType: AllowedPhotoType, buf: Buffer): boolean {
  if (mimeType === "image/jpeg") {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  // image/webp — RIFF....WEBP header
  return buf.length >= 12
    && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
    && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
}

/**
 * Validates a base64 data URL photo: allowed MIME type (jpeg/png/webp),
 * decoded size limit and magic-byte sniffing so the MIME cannot be spoofed.
 */
export function validatePhotoDataUrl(dataUrl: string, maxBytes = MAX_PHOTO_BYTES): PhotoValidationResult {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return { ok: false, error: "photo_data must be an image data URL" };
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    return { ok: false, error: "Unsupported image type — use JPEG, PNG or WebP" };
  }

  const mimeType = match[1] as AllowedPhotoType;
  const base64 = match[2];

  let buf: Buffer;
  try {
    buf = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "Invalid image data" };
  }

  if (buf.length === 0) {
    return { ok: false, error: "Invalid image data" };
  }
  if (buf.length > maxBytes) {
    return { ok: false, error: `Photo exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit` };
  }
  if (!matchesMagic(mimeType, buf)) {
    return { ok: false, error: "File content does not match its image type" };
  }

  return { ok: true, mimeType, bytes: buf.length };
}
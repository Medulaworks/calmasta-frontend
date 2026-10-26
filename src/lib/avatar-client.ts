import { ApiError, api } from "./upload-client";

export const AVATAR_SIZE = 256;
export const MAX_PICK_BYTES = 12 * 1024 * 1024; // what we will even try to open; the result sent is far smaller

/** Opens the chosen picture, crops it to a centred square and shrinks it. This also drops any hidden camera/location data. */
export async function prepareAvatar(file: File): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Use a PNG, JPG or WebP picture.");
  if (file.size > MAX_PICK_BYTES) throw new Error("That picture is very large. Choose one under 12 MB.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That picture couldn't be read. Try another one.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't prepare pictures.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.9));
  if (blob && blob.type === "image/webp") return blob;
  const jpg = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!jpg) throw new Error("That picture couldn't be prepared. Try another one.");
  return jpg;
}

/** Uploads a prepared picture in the same three steps as an audio upload: ask, send, confirm. */
export async function uploadAvatar(blob: Blob): Promise<string> {
  const { key, uploadUrl } = await api<{ key: string; uploadUrl: string }>("/api/me/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: blob.type, sizeBytes: blob.size }),
  });
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });
  if (!put.ok) throw new ApiError(put.status, "The picture couldn't be uploaded. Please try again.");
  const done = await api<{ avatarUrl: string }>("/api/me/avatar/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
  return done.avatarUrl;
}

export const removeAvatar = () => api<void>("/api/me/avatar", { method: "DELETE" });

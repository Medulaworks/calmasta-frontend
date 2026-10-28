import { ApiError, api } from "./upload-client";

export const AVATAR_SIZE = 256;
export const MAX_PICK_BYTES = 12 * 1024 * 1024; // what we will even try to open; the result sent is far smaller
export const MAX_AVATAR_BYTES = 1024 * 1024; // 1 MiB backend limit

export interface AvatarProfileResult {
  avatarUrl: string | null;
  avatarExpiresAt: string | null;
  avatarVersion: number;
}

type AvatarIntentResponse =
  | {
      id: string;
      state: "awaiting_upload";
      expiresAt: string;
      upload: { url: string; headers: Record<string, string> };
    }
  | ({
      id: string;
      state: "completed";
    } & AvatarProfileResult);

type AvatarAttempt = {
  key: string;
  expectedVersion: number;
  intent?: AvatarIntentResponse;
  uploaded: boolean;
};

const attempts = new WeakMap<Blob, AvatarAttempt>();

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

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
  if (!ctx) {
    bitmap.close();
    throw new Error("Your browser can't prepare pictures.");
  }
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.9));
  if (blob && blob.type === "image/webp" && blob.size <= MAX_AVATAR_BYTES) return blob;
  const jpg = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!jpg || jpg.size > MAX_AVATAR_BYTES) throw new Error("That picture couldn't be prepared under 1 MB. Try another one.");
  return jpg;
}

/** Uploads a prepared picture in three steps: create intent, PUT to signed R2 URL, and complete. */
export async function uploadAvatar(
  blob: Blob,
  expectedVersion: number,
  idempotencyKey?: string,
): Promise<AvatarProfileResult> {
  if (!/^image\/(png|jpeg|webp)$/.test(blob.type)) {
    throw new Error("Use a PNG, JPG or WebP picture.");
  }
  if (blob.size < 1 || blob.size > MAX_AVATAR_BYTES) {
    throw new Error("Use a PNG, JPG or WebP picture under 1 MB.");
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error("Profile version is invalid. Refresh and try again.");
  }

  let attempt = attempts.get(blob);
  if (!attempt || attempt.expectedVersion !== expectedVersion || (idempotencyKey && attempt.key !== idempotencyKey)) {
    attempt = {
      key: idempotencyKey ?? crypto.randomUUID(),
      expectedVersion,
      uploaded: false,
    };
    attempts.set(blob, attempt);
  }

  try {
    if (!attempt.intent) {
      const sha256 = await sha256Hex(blob);
      attempt.intent = await api<AvatarIntentResponse>("/api/account/me/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attempt.key,
        },
        body: JSON.stringify({
          contentType: blob.type,
          sizeBytes: blob.size,
          sha256,
          expectedVersion,
        }),
      });
    }

    if (attempt.intent.state === "completed") {
      attempts.delete(blob);
      return {
        avatarUrl: attempt.intent.avatarUrl,
        avatarExpiresAt: attempt.intent.avatarExpiresAt,
        avatarVersion: attempt.intent.avatarVersion,
      };
    }

    if (!attempt.uploaded) {
      const putHeaders: Record<string, string> = {};
      for (const [name, value] of Object.entries(attempt.intent.upload.headers)) {
        if (name.toLowerCase() === "content-length") {
          if (Number(value) !== blob.size) throw new Error("Upload size mismatch.");
        } else {
          putHeaders[name] = value;
        }
      }
      const put = await fetch(attempt.intent.upload.url, {
        method: "PUT",
        headers: putHeaders,
        body: blob,
        credentials: "omit",
      });
      if (!put.ok && put.status !== 412) {
        throw new ApiError(put.status, "The picture couldn't be uploaded. Please try again.");
      }
      attempt.uploaded = true;
    }

    const done = await api<AvatarProfileResult>("/api/account/me/avatar/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: attempt.intent.id }),
    });
    attempts.delete(blob);
    return done;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === "avatar_upload_expired" || err.code === "avatar_version_conflict" || err.code === "avatar_superseded") {
        attempts.delete(blob);
      } else if (err.code === "avatar_upload_incomplete") {
        attempt.uploaded = false;
      }
    }
    throw err;
  }
}

export const removeAvatar = (expectedVersion: number) =>
  api<AvatarProfileResult>("/api/account/me/avatar", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedVersion }),
  });

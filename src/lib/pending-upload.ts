// A tiny hand-off: a file dropped on the dashboard is kept here while the page changes to the recorder, which picks it up.
// It lives in memory only (never stored), and is taken exactly once.

let pending: File | null = null;

export function setPendingFile(file: File) {
  pending = file;
}

export function takePendingFile(): File | null {
  const f = pending;
  pending = null;
  return f;
}
